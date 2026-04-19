import { Socket } from 'node:net';
import type { IRconGateway } from '../../domain/repositories/i-rcon-gateway.ts';
import type { RconResponse } from '../../domain/entities/value-objects.ts';
import { RconAuthError, RconConnectionError } from '../../domain/entities/errors.ts';

// ── Source RCON Packet Types ──

export const PACKET_TYPE = {
  AUTH: 3,
  AUTH_RESPONSE: 2,
  EXEC_COMMAND: 2,
  RESPONSE_VALUE: 0,
} as const;

// ── Pure Functions: Packet Codec ──

/**
 * Encode a Source RCON packet.
 *
 * Packet structure (little-endian):
 *   [4 bytes] size    — payload length (id + type + body + null + padding)
 *   [4 bytes] id      — request ID (int32)
 *   [4 bytes] type    — packet type
 *   [N bytes] body    — null-terminated ASCII string
 *   [1 byte]  padding — 0x00
 */
export function encodeRconPacket(
  id: number,
  type: number,
  body: string,
): Buffer {
  const bodyBuf = Buffer.from(body, 'ascii');
  const size = 4 + 4 + bodyBuf.length + 1 + 1; // id + type + body + null + padding
  const buf = Buffer.alloc(4 + size);

  buf.writeInt32LE(size, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  buf[12 + bodyBuf.length] = 0x00; // null terminator
  buf[12 + bodyBuf.length + 1] = 0x00; // padding

  return buf;
}

/**
 * Decode a Source RCON packet from a buffer.
 * Returns { requestId, type, body }.
 */
export function decodeRconPacket(buf: Buffer): RconResponse {
  const size = buf.readInt32LE(0);
  const requestId = buf.readInt32LE(4);
  const type = buf.readInt32LE(8);

  // Body: from offset 12 to (4 + size - 2) — excludes null terminator and padding
  const bodyEnd = 4 + size - 2;
  const bodyStart = 12;
  const body =
    bodyEnd > bodyStart
      ? buf.subarray(bodyStart, bodyEnd).toString('ascii')
      : '';

  return { requestId, type, body };
}

// ── Constants ──

const DEFAULT_TIMEOUT = 10_000; // 10 seconds per command

// ── TcpRconGateway Adapter ──

export class TcpRconGateway implements IRconGateway {
  private socket: Socket | null = null;
  private connected = false;
  private requestId = 0;
  private readonly timeout: number;
  private pendingResolve: ((response: RconResponse) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private receiveBuffer: Buffer = Buffer.alloc(0);

  constructor(options?: { timeout?: number }) {
    this.timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  }

  async connect(host: string, port: number, password: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const socket = new Socket();

      socket.setTimeout(this.timeout);
      socket.setNoDelay(true);

      socket.on('error', (err) => {
        this.connected = false;
        if (this.pendingReject) {
          this.pendingReject(new RconConnectionError(err));
          this.pendingReject = null;
          this.pendingResolve = null;
        } else {
          reject(new RconConnectionError(err));
        }
      });

      socket.on('timeout', () => {
        this.connected = false;
        const err = new RconConnectionError(new Error('Connection timeout'));
        if (this.pendingReject) {
          this.pendingReject(err);
          this.pendingReject = null;
          this.pendingResolve = null;
        }
        socket.destroy();
      });

      socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      socket.connect(port, host, () => {
        this.socket = socket;
        this.receiveBuffer = Buffer.alloc(0);

        // Send AUTH packet
        this.sendPacket(PACKET_TYPE.AUTH, password)
          .then((response) => {
            if (response.requestId === -1) {
              this.connected = false;
              reject(new RconAuthError());
            } else {
              this.connected = true;
              resolve();
            }
          })
          .catch(reject);
      });
    });
  }

  /**
   * Test helper: connect with an already-created socket (for mocking).
   * @internal
   */
  async _connectWithSocket(socket: any, password: string): Promise<void> {
    this.socket = socket;
    this.connected = false;
    this.receiveBuffer = Buffer.alloc(0);

    socket.on('data', (data: Buffer) => {
      this.handleData(data);
    });

    const response = await this.sendPacket(PACKET_TYPE.AUTH, password);

    if (response.requestId === -1) {
      this.connected = false;
      throw new RconAuthError();
    }

    this.connected = true;
  }

  async sendCommand(command: string): Promise<RconResponse> {
    if (!this.connected || !this.socket) {
      throw new RconConnectionError(new Error('Not connected'));
    }

    return this.sendPacket(PACKET_TYPE.EXEC_COMMAND, command);
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.end();
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.pendingResolve = null;
    this.pendingReject = null;
    this.receiveBuffer = Buffer.alloc(0);
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ── Private ──

  private sendPacket(type: number, body: string): Promise<RconResponse> {
    return new Promise<RconResponse>((resolve, reject) => {
      if (!this.socket) {
        reject(new RconConnectionError(new Error('No socket')));
        return;
      }

      this.requestId++;
      const packet = encodeRconPacket(this.requestId, type, body);

      this.pendingResolve = resolve;
      this.pendingReject = reject;

      // Set a timeout for this specific command
      const timer = setTimeout(() => {
        if (this.pendingReject) {
          this.pendingReject(
            new RconConnectionError(new Error('Command timeout')),
          );
          this.pendingResolve = null;
          this.pendingReject = null;
        }
      }, this.timeout);

      this.socket.write(packet, () => {
        // Packet sent — wait for response via handleData
        // Clear timeout if response arrives first (handled in handleData)
        // Store timer reference for cleanup
        (this as any)._currentTimer = timer;
      });
    });
  }

  private handleData(data: Buffer): void {
    // Accumulate data in receive buffer
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);

    // Check if we have a complete packet
    if (this.receiveBuffer.length < 4) return;

    const packetSize = this.receiveBuffer.readInt32LE(0);
    const totalSize = 4 + packetSize;

    if (this.receiveBuffer.length < totalSize) return;

    // Extract the complete packet
    const packetBuf = this.receiveBuffer.subarray(0, totalSize);
    this.receiveBuffer = this.receiveBuffer.subarray(totalSize);

    const response = decodeRconPacket(packetBuf);

    // Clear timeout
    if ((this as any)._currentTimer) {
      clearTimeout((this as any)._currentTimer);
      (this as any)._currentTimer = null;
    }

    // Resolve pending promise
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      this.pendingReject = null;
      resolve(response);
    }
  }
}
