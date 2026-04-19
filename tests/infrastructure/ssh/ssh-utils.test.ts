import { describe, it, expect } from 'bun:test';
import { generateSshKeyPair } from '@/infrastructure/ssh/ssh-utils.ts';

describe('generateSshKeyPair', () => {
  it('should generate valid PEM private key and OpenSSH public key', () => {
    const { privateKey, publicKey } = generateSshKeyPair();
    
    expect(privateKey).toContain('BEGIN PRIVATE KEY');
    expect(publicKey).toContain('ssh-ed25519');
    
    // Check if base64 part is valid
    const [type, base64Key] = publicKey.split(' ');
    expect(type).toBe('ssh-ed25519');
    expect(base64Key).toBeDefined();
    expect(() => Buffer.from(base64Key!, 'base64')).not.toThrow();
  });
});
