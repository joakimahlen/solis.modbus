import type { Logger, ModbusTransport } from '@digistrada/modbus-core';
import * as Modbus from 'jsmodbus';
import net from 'net';

const REQUEST_TIMEOUT_MS = 5000;
const RECONNECT_MIN_MS = 5000;
const RECONNECT_MAX_MS = 60_000;
/** No successful response for this long while connected → the socket is assumed dead and reopened. */
const IDLE_RECONNECT_MS = 120_000;

type TcpClient = InstanceType<typeof Modbus.client.TCP>;

const SOCKET_EVENTS = ['connect', 'close', 'data'] as const;

interface UnitClient {
    client: TcpClient;
    refCount: number;
    /** Listeners the jsmodbus client added to the shared socket, removed when the unit is released. */
    listeners: Array<[string, (...args: unknown[]) => void]>;
}

/** A device's view of a shared connection: a transport bound to its unit id. */
export interface ModbusLease {
    readonly transport: ModbusTransport;
    readonly online: boolean;
    release(): void;
}

interface Link {
    key: string;
    host: string;
    port: number;
    socket: net.Socket;
    clients: Map<number, UnitClient>;
    refCount: number;
    online: boolean;
    queue: Promise<unknown>;
    lastSuccessAt: number;
    backoffMs: number;
    reopening: boolean;
    reconnectTimer?: ReturnType<typeof setTimeout>;
    closed: boolean;
    logger: Logger;
}

/** One TCP socket per host:port, shared by every device on it; requests are serialized per socket. */
class ModbusClientManager {
    private readonly links = new Map<string, Link>();

    acquire(host: string, port: number, unitId: number, logger: Logger): ModbusLease {
        const link = this.link(host, port, logger);
        link.refCount++;
        let unit = link.clients.get(unitId);
        if (!unit) {
            const before = new Map(SOCKET_EVENTS.map((event) => [event, link.socket.listeners(event)]));
            const client = new Modbus.client.TCP(link.socket, unitId, REQUEST_TIMEOUT_MS);
            const listeners = SOCKET_EVENTS.flatMap((event) => link.socket.listeners(event)
                .filter((listener) => !before.get(event)!.includes(listener))
                .map((listener) => [event, listener as (...args: unknown[]) => void] as [string, (...args: unknown[]) => void]));
            unit = { client, refCount: 0, listeners };
            link.clients.set(unitId, unit);
            // A jsmodbus client goes online only on a connect event; replay it instead of dropping the shared socket.
            if (link.online) listeners.filter(([event]) => event === 'connect').forEach(([, listener]) => listener());
        }
        unit.refCount++;
        const unitClient = unit;
        const tcp = unit.client;
        const request = <T>(run: () => Promise<T>) => this.request(link, run);
        let released = false;
        return {
            transport: {
                readHolding: (addr, len) => request(() => tcp.readHoldingRegisters(addr, len)).then((r) => [...r.response.body.values]),
                readInput: (addr, len) => request(() => tcp.readInputRegisters(addr, len)).then((r) => [...r.response.body.values]),
                writeSingle: (addr, value) => request(() => tcp.writeSingleRegister(addr, value)).then(() => undefined),
                writeMultiple: (addr, values) => request(() => tcp.writeMultipleRegisters(addr, values)).then(() => undefined),
            },
            get online() {
                return link.online;
            },
            release: () => {
                if (released) return;
                released = true;
                unitClient.refCount--;
                if (unitClient.refCount <= 0) {
                    unitClient.listeners.forEach(([event, listener]) => link.socket.off(event, listener));
                    link.clients.delete(unitId);
                }
                link.refCount--;
                if (link.refCount <= 0) this.close(link);
            },
        };
    }

    private link(host: string, port: number, logger: Logger): Link {
        const key = `${host}:${port}`;
        const existing = this.links.get(key);
        if (existing) return existing;

        const link: Link = {
            key, host, port, logger,
            socket: new net.Socket(),
            clients: new Map(),
            refCount: 0,
            online: false,
            queue: Promise.resolve(),
            lastSuccessAt: Date.now(),
            backoffMs: RECONNECT_MIN_MS,
            reopening: false,
            closed: false,
        };
        link.socket.setKeepAlive(true);
        link.socket.on('connect', () => {
            logger.log(`=== Shared connection [${key}] connected`);
            link.online = true;
            link.lastSuccessAt = Date.now();
            link.backoffMs = RECONNECT_MIN_MS;
        });
        link.socket.on('error', (err) => logger.log(`=== Shared connection [${key}] error: ${err.message}`));
        link.socket.on('close', () => {
            link.online = false;
            if (link.closed) return;
            const delayMs = link.reopening ? 0 : link.backoffMs;
            link.reopening = false;
            logger.log(`=== Shared connection [${key}] closed. Reconnecting in ${delayMs / 1000}s...`);
            link.reconnectTimer = setTimeout(() => this.connect(link), delayMs);
            if (delayMs > 0) link.backoffMs = Math.min(link.backoffMs * 2, RECONNECT_MAX_MS);
        });
        this.links.set(key, link);
        this.connect(link);
        return link;
    }

    private connect(link: Link): void {
        link.reconnectTimer = undefined;
        if (link.closed) return;
        link.socket.connect({ host: link.host, port: link.port });
    }

    private reopen(link: Link): void {
        link.reopening = true;
        link.socket.destroy();
    }

    private request<T>(link: Link, run: () => Promise<T>): Promise<T> {
        const result = link.queue.then(async () => {
            if (!link.online) {
                throw new Error(`No Modbus connection to ${link.key}`);
            }
            try {
                const value = await run();
                link.lastSuccessAt = Date.now();
                return value;
            } catch (err) {
                if (Date.now() - link.lastSuccessAt > IDLE_RECONNECT_MS) {
                    link.logger.log(`== No successful read for ${IDLE_RECONNECT_MS / 1000} s, reconnecting [${link.key}]`);
                    link.lastSuccessAt = Date.now();
                    this.reopen(link);
                }
                throw err;
            }
        });
        link.queue = result.catch(() => undefined);
        return result;
    }

    private close(link: Link): void {
        link.closed = true;
        link.online = false;
        clearTimeout(link.reconnectTimer);
        link.socket.destroy();
        this.links.delete(link.key);
    }
}

/** Shared by every device in the app. */
export const modbusClients = new ModbusClientManager();
