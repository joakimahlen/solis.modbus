import * as Modbus from 'jsmodbus';
import net from 'net';

export interface ConnectionHandle {
  client: InstanceType<typeof Modbus.client.TCP>;
  onConnect(callback: () => void): void;
  release(): void;
}

interface ManagedConnection {
  socket: net.Socket;
  client: InstanceType<typeof Modbus.client.TCP>;
  refCount: number;
  connectionOptions: net.SocketConnectOpts;
  connectCallbacks: Array<() => void>;
}

const connections = new Map<string, ManagedConnection>();

function getKey(address: string, port: number, unitId: number): string {
  return `${address}:${port}:${unitId}`;
}

function connectSocket(conn: ManagedConnection, log: (...args: unknown[]) => void) {
  conn.socket.setKeepAlive(true);
  log('=== Shared connection connecting...', conn.connectionOptions);
  conn.socket.connect(conn.connectionOptions);
}

export function acquireConnection(
  address: string,
  port: number,
  unitId: number,
  log: (...args: unknown[]) => void,
): ConnectionHandle {
  const key = getKey(address, port, unitId);
  let conn = connections.get(key);

  if (conn) {
    conn.refCount++;
    log(`=== Reusing shared connection [${key}] (refCount: ${conn.refCount})`);
  } else {
    const socket = new net.Socket();
    const client = new Modbus.client.TCP(socket, unitId, 5000);
    const connectionOptions: net.SocketConnectOpts = { host: address, port, keepAlive: true };

    conn = { socket, client, refCount: 1, connectionOptions, connectCallbacks: [] };
    connections.set(key, conn);

    socket.on('connect', () => {
      log(`=== Shared connection [${key}] connected`);
      for (const cb of conn!.connectCallbacks) {
        cb();
      }
    });

    socket.on('close', () => {
      log(`=== Shared connection [${key}] closed. Reconnecting in 5s...`);
      setTimeout(() => connectSocket(conn!, log), 5000);
    });

    socket.on('timeout', () => {
      log(`=== Shared connection [${key}] timed out!`);
      client.socket.end();
      socket.end();
    });

    socket.on('error', (err) => {
      log(`=== Shared connection [${key}] error`, err);
      client.socket.end();
      socket.end();
    });

    connectSocket(conn, log);
    log(`=== Created new shared connection [${key}]`);
  }

  const capturedConn = conn;

  return {
    client: capturedConn.client,

    onConnect(callback: () => void) {
      capturedConn.connectCallbacks.push(callback);
      // If already connected, fire immediately
      if (capturedConn.socket.readyState === 'open') {
        callback();
      }
    },

    release() {
      capturedConn.refCount--;
      log(`=== Released shared connection [${key}] (refCount: ${capturedConn.refCount})`);
      if (capturedConn.refCount <= 0) {
        capturedConn.socket.destroy();
        connections.delete(key);
        log(`=== Destroyed shared connection [${key}]`);
      }
    },
  };
}
