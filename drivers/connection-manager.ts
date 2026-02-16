import * as Modbus from 'jsmodbus';
import net from 'net';

interface ManagedConnection {
  socket: net.Socket;
  client: InstanceType<typeof Modbus.client.TCP>;
  refCount: number;
  connectionOptions: net.SocketConnectOpts;
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
): { socket: net.Socket; client: InstanceType<typeof Modbus.client.TCP> } {
  const key = getKey(address, port, unitId);
  const existing = connections.get(key);

  if (existing) {
    existing.refCount++;
    log(`=== Reusing shared connection [${key}] (refCount: ${existing.refCount})`);
    return { socket: existing.socket, client: existing.client };
  }

  const socket = new net.Socket();
  const client = new Modbus.client.TCP(socket, unitId, 5000);
  const connectionOptions: net.SocketConnectOpts = { host: address, port, keepAlive: true };

  const conn: ManagedConnection = { socket, client, refCount: 1, connectionOptions };
  connections.set(key, conn);

  socket.on('close', () => {
    log(`=== Shared connection [${key}] closed. Reconnecting in 5s...`);
    setTimeout(() => connectSocket(conn, log), 5000);
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

  return { socket, client };
}

export function releaseConnection(
  address: string,
  port: number,
  unitId: number,
  log: (...args: unknown[]) => void,
): void {
  const key = getKey(address, port, unitId);
  const conn = connections.get(key);
  if (conn) {
    conn.refCount--;
    log(`=== Released shared connection [${key}] (refCount: ${conn.refCount})`);
    if (conn.refCount <= 0) {
      conn.socket.destroy();
      connections.delete(key);
      log(`=== Destroyed shared connection [${key}]`);
    }
  }
}
