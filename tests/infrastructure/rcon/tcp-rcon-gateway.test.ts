import { describe, it, expect, beforeEach, mock, afterEach } from 'bun:test';
import type { RconResponse } from '../../../src/domain/entities/value-objects.ts';
import { RconAuthError, RconConnectionError } from '../../../src/domain/entities/errors.ts';
import { Socket } from 'node:net';

// Production code that does NOT exist yet — guarantees RED
import {
  TcpRconGateway,
  encodeRconPacket,
  decodeRconPacket,
  PACKET_TYPE,
} from '../../../src/infrastructure/rcon/tcp-rcon-gateway.ts';

// Mock node:net
let mockSocketInstance: any = null;
let shouldFailAuth = false;

mock.module('node:net', () => {
  return {
    Socket: class {
      public listeners: Record<string, Function[]> = {};
      
      constructor() {
        mockSocketInstance = this;
      }

      trigger(event: string, ...args: any[]) {
        (this.listeners[event] || []).forEach(l => l(...args));
      }
      
      connect = mock(function(this: any, port: number, host: string, cb: any) {
        if (cb) setTimeout(cb, 0);
        return this;
      });
      
      on = mock(function(this: any, event: string, cb: Function) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(cb);
        return this;
      });
      
      write = mock(function(this: any, data: Buffer, cb?: Function) {
        // Source RCON: [4 size][4 id][4 type][body][null][null]
        const type = data.readInt32LE(8);
        const requestId = data.readInt32LE(4);
        
        if (type === PACKET_TYPE.AUTH) {
          // Send AUTH_RESPONSE
          const resp = buildResponsePacket(
            shouldFailAuth ? -1 : requestId, 
            PACKET_TYPE.AUTH_RESPONSE, 
            ''
          );
          setTimeout(() => {
            this.trigger('data', resp);
          }, 0);
        } else if (type === PACKET_TYPE.EXEC_COMMAND) {
          // Send RESPONSE_VALUE
          const resp = buildResponsePacket(requestId, PACKET_TYPE.RESPONSE_VALUE, 'Mock Output');
          setTimeout(() => {
            this.trigger('data', resp);
          }, 0);
        }
        
        if (cb) cb();
        return true;
      });
      
      setTimeout = mock(function(this: any) { return this; });
      setNoDelay = mock(function(this: any) { return this; });
      destroy = mock(function(this: any) { return this; });
      end = mock(function(this: any) { return this; });
    }
  };
});

// ── Pure Function Tests: RCON Packet Codec ──

describe('RCON Packet Codec (pure functions)', () => {
  describe('encodeRconPacket', () => {
    it('should encode a packet with correct structure', () => {
      const buf = encodeRconPacket(1, PACKET_TYPE.AUTH, 'password123');

      // Source RCON: [4 size][4 id][4 type][body][null][null]
      // size = 4 (id) + 4 (type) + body.length + 1 (null) + 1 (padding) = 10 + body.length
      const bodyLen = Buffer.byteLength('password123');
      const expectedSize = 4 + 4 + bodyLen + 1 + 1;

      // First 4 bytes = size (little-endian int32)
      const size = buf.readInt32LE(0);
      expect(size).toBe(expectedSize);

      // Next 4 bytes = id
      const id = buf.readInt32LE(4);
      expect(id).toBe(1);

      // Next 4 bytes = type
      const type = buf.readInt32LE(8);
      expect(type).toBe(PACKET_TYPE.AUTH);

      // Body starts at offset 12
      const body = buf.subarray(12, 12 + bodyLen).toString('ascii');
      expect(body).toBe('password123');

      // Null terminators
      expect(buf[12 + bodyLen]).toBe(0x00);
      expect(buf[12 + bodyLen + 1]).toBe(0x00);

      // Total buffer length = 4 (size field) + size
      expect(buf.length).toBe(4 + expectedSize);
    });

    it('should encode empty body correctly', () => {
      const buf = encodeRconPacket(42, PACKET_TYPE.EXEC_COMMAND, '');

      const size = buf.readInt32LE(0);
      expect(size).toBe(4 + 4 + 0 + 1 + 1); // 10

      const id = buf.readInt32LE(4);
      expect(id).toBe(42);

      const type = buf.readInt32LE(8);
      expect(type).toBe(PACKET_TYPE.EXEC_COMMAND);

      expect(buf.length).toBe(4 + 10); // 14
    });

    it('should encode different packet types correctly', () => {
      const authBuf = encodeRconPacket(1, PACKET_TYPE.AUTH, 'pw');
      expect(authBuf.readInt32LE(8)).toBe(3); // AUTH = 3

      const execBuf = encodeRconPacket(2, PACKET_TYPE.EXEC_COMMAND, 'players');
      expect(execBuf.readInt32LE(8)).toBe(2); // EXEC_COMMAND = 2
    });
  });

  describe('decodeRconPacket', () => {
    it('should decode a valid response packet', () => {
      // Manually build a response packet
      const body = 'Players connected (3):';
      const bodyBuf = Buffer.from(body, 'ascii');
      const size = 4 + 4 + bodyBuf.length + 1 + 1;
      const buf = Buffer.alloc(4 + size);

      buf.writeInt32LE(size, 0);
      buf.writeInt32LE(99, 4);                     // id = 99
      buf.writeInt32LE(PACKET_TYPE.RESPONSE_VALUE, 8); // type = 0
      bodyBuf.copy(buf, 12);
      buf[12 + bodyBuf.length] = 0x00;             // null terminator
      buf[12 + bodyBuf.length + 1] = 0x00;         // padding

      const packet = decodeRconPacket(buf);

      expect(packet.requestId).toBe(99);
      expect(packet.type).toBe(PACKET_TYPE.RESPONSE_VALUE);
      expect(packet.body).toBe('Players connected (3):');
    });

    it('should decode auth response with id = -1 (auth failure)', () => {
      const size = 4 + 4 + 0 + 1 + 1; // empty body
      const buf = Buffer.alloc(4 + size);

      buf.writeInt32LE(size, 0);
      buf.writeInt32LE(-1, 4);                      // id = -1 = auth failure
      buf.writeInt32LE(PACKET_TYPE.AUTH_RESPONSE, 8);
      buf[12] = 0x00;
      buf[13] = 0x00;

      const packet = decodeRconPacket(buf);

      expect(packet.requestId).toBe(-1);
      expect(packet.type).toBe(PACKET_TYPE.AUTH_RESPONSE);
    });

    it('should decode packet with empty body', () => {
      const size = 4 + 4 + 0 + 1 + 1;
      const buf = Buffer.alloc(4 + size);

      buf.writeInt32LE(size, 0);
      buf.writeInt32LE(5, 4);
      buf.writeInt32LE(PACKET_TYPE.RESPONSE_VALUE, 8);
      buf[12] = 0x00;
      buf[13] = 0x00;

      const packet = decodeRconPacket(buf);

      expect(packet.requestId).toBe(5);
      expect(packet.body).toBe('');
    });

    it('should handle multi-byte body content', () => {
      const body = 'save\nWorld saved successfully.';
      const bodyBuf = Buffer.from(body, 'ascii');
      const size = 4 + 4 + bodyBuf.length + 1 + 1;
      const buf = Buffer.alloc(4 + size);

      buf.writeInt32LE(size, 0);
      buf.writeInt32LE(7, 4);
      buf.writeInt32LE(PACKET_TYPE.RESPONSE_VALUE, 8);
      bodyBuf.copy(buf, 12);
      buf[12 + bodyBuf.length] = 0x00;
      buf[12 + bodyBuf.length + 1] = 0x00;

      const packet = decodeRconPacket(buf);

      expect(packet.requestId).toBe(7);
      expect(packet.body).toBe(body);
    });
  });

  describe('round-trip encode → decode', () => {
    it('should round-trip a command packet', () => {
      const encoded = encodeRconPacket(123, PACKET_TYPE.EXEC_COMMAND, 'servermsg "Hello"');
      const decoded = decodeRconPacket(encoded);

      expect(decoded.requestId).toBe(123);
      expect(decoded.type).toBe(PACKET_TYPE.EXEC_COMMAND);
      expect(decoded.body).toBe('servermsg "Hello"');
    });

    it('should round-trip an auth packet', () => {
      const encoded = encodeRconPacket(1, PACKET_TYPE.AUTH, 'my-secret-password');
      const decoded = decodeRconPacket(encoded);

      expect(decoded.requestId).toBe(1);
      expect(decoded.type).toBe(PACKET_TYPE.AUTH);
      expect(decoded.body).toBe('my-secret-password');
    });

    it('should round-trip empty body', () => {
      const encoded = encodeRconPacket(0, PACKET_TYPE.RESPONSE_VALUE, '');
      const decoded = decodeRconPacket(encoded);

      expect(decoded.requestId).toBe(0);
      expect(decoded.body).toBe('');
    });
  });
});

// ── PACKET_TYPE Constants ──

describe('PACKET_TYPE constants', () => {
  it('should have correct values per Source RCON protocol', () => {
    expect(PACKET_TYPE.AUTH).toBe(3);
    expect(PACKET_TYPE.EXEC_COMMAND).toBe(2);
    expect(PACKET_TYPE.RESPONSE_VALUE).toBe(0);
    expect(PACKET_TYPE.AUTH_RESPONSE).toBe(2);
  });
});

// ── TcpRconGateway Class Tests ──

describe('TcpRconGateway', () => {
  let gateway: TcpRconGateway;

  beforeEach(() => {
    gateway = new TcpRconGateway();
  });

  describe('public connect()', () => {
    it('should connect and authenticate via public connect() method', async () => {
      const gateway = new TcpRconGateway();
      await gateway.connect('127.0.0.1', 27015, 'password123');
      expect(gateway.isConnected()).toBe(true);
    });

    it('should throw RconConnectionError on socket error during connect', async () => {
      const gateway = new TcpRconGateway();
      
      const connectPromise = gateway.connect('127.0.0.1', 27015, 'pass');
      
      // Simulate socket error before AUTH starts
      setTimeout(() => {
        mockSocketInstance?.trigger('error', new Error('Connection refused'));
      }, 0);

      await expect(connectPromise).rejects.toThrow(RconConnectionError);
      expect(gateway.isConnected()).toBe(false);
    });

    it('should throw RconAuthError on auth failure via public connect()', async () => {
      const gateway = new TcpRconGateway();
      shouldFailAuth = true;

      try {
        await gateway.connect('127.0.0.1', 27015, 'wrong-pass');
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(RconAuthError);
      } finally {
        shouldFailAuth = false;
      }
      expect(gateway.isConnected()).toBe(false);
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(gateway.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should not throw when not connected', async () => {
      await expect(gateway.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('sendCommand when not connected', () => {
    it('should throw RconConnectionError when not connected', async () => {
      try {
        await gateway.sendCommand('players');
        expect(true).toBe(false); // should not reach
      } catch (err) {
        expect(err).toBeInstanceOf(RconConnectionError);
      }
    });
  });

  describe('connect with mock socket', () => {
    it('should set connected state after successful auth', async () => {
      // We test this via the _connectWithSocket test helper
      const authResponseId = 1;
      const authResponseBuf = buildResponsePacket(
        authResponseId,
        PACKET_TYPE.AUTH_RESPONSE,
        '',
      );

      const mockSocket = createMockSocket([authResponseBuf]);
      await gateway._connectWithSocket(mockSocket as any, 'password123');

      expect(gateway.isConnected()).toBe(true);
    });

    it('should throw RconAuthError on auth failure (id = -1)', async () => {
      const authResponseBuf = buildResponsePacket(
        -1,
        PACKET_TYPE.AUTH_RESPONSE,
        '',
      );

      const mockSocket = createMockSocket([authResponseBuf]);

      try {
        await gateway._connectWithSocket(mockSocket as any, 'wrong-password');
        expect(true).toBe(false); // should not reach
      } catch (err) {
        expect(err).toBeInstanceOf(RconAuthError);
      }
    });
  });

  describe('sendCommand with mock socket', () => {
    it('should send EXEC_COMMAND and return response body', async () => {
      // First: auth success
      const authBuf = buildResponsePacket(1, PACKET_TYPE.AUTH_RESPONSE, '');
      // Then: command response
      const cmdBuf = buildResponsePacket(2, PACKET_TYPE.RESPONSE_VALUE, 'World saved.');

      const mockSocket = createMockSocket([authBuf, cmdBuf]);
      await gateway._connectWithSocket(mockSocket as any, 'pass');

      const response = await gateway.sendCommand('save');

      expect(response.body).toBe('World saved.');
      expect(response.type).toBe(PACKET_TYPE.RESPONSE_VALUE);
    });

    it('should handle players command response', async () => {
      const authBuf = buildResponsePacket(1, PACKET_TYPE.AUTH_RESPONSE, '');
      const playersBuf = buildResponsePacket(
        2,
        PACKET_TYPE.RESPONSE_VALUE,
        'Players connected (3):\n-player1\n-player2\n-player3\n',
      );

      const mockSocket = createMockSocket([authBuf, playersBuf]);
      await gateway._connectWithSocket(mockSocket as any, 'pass');

      const response = await gateway.sendCommand('players');

      expect(response.body).toContain('Players connected (3)');
      expect(response.body).toContain('player1');
      expect(response.body).toContain('player3');
    });
  });
});

// ── Test Helpers ──

function buildResponsePacket(
  id: number,
  type: number,
  body: string,
): Buffer {
  const bodyBuf = Buffer.from(body, 'ascii');
  const size = 4 + 4 + bodyBuf.length + 1 + 1;
  const buf = Buffer.alloc(4 + size);

  buf.writeInt32LE(size, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  buf[12 + bodyBuf.length] = 0x00;
  buf[12 + bodyBuf.length + 1] = 0x00;

  return buf;
}

function createMockSocket(responses: Buffer[]) {
  let responseIndex = 0;
  const listeners: Record<string, Function[]> = {};

  const socket: any = {
    on: mock((event: string, cb: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event]!.push(cb);
      return socket;
    }),
    write: mock((data: Buffer, cb?: Function) => {
      // When data is written, schedule the next response
      if (responseIndex < responses.length) {
        const resp = responses[responseIndex]!;
        responseIndex++;
        setTimeout(() => {
          const dataListeners = listeners['data'] ?? [];
          for (const l of dataListeners) {
            l(resp);
          }
        }, 5);
      }
      if (cb) cb();
      return true;
    }),
    end: mock(() => {}),
    destroy: mock(() => {}),
    removeAllListeners: mock(() => socket),
    setTimeout: mock(() => socket),
    setNoDelay: mock(() => socket),
    connect: mock(() => socket),
  };

  return socket;
}
