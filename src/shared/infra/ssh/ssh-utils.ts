import { generateKeyPairSync } from 'node:crypto';

export function generateSshKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'der' },
  });

  // Convert SPKI DER to OpenSSH format
  // SPKI Ed25519 DER: 30 2a 30 05 06 03 2b 65 70 03 21 00 <32-byte-key>
  // OpenSSH: ssh-ed25519 <base64(ssh-ed25519 + <key>)>
  
  const keyBytes = publicKey.subarray(12); // Skip the first 12 bytes of the SPKI DER
  
  const type = 'ssh-ed25519';
  const typeBytes = Buffer.from(type);
  const keyLengthBytes = Buffer.alloc(4);
  keyLengthBytes.writeUInt32BE(keyBytes.length);
  const typeLengthBytes = Buffer.alloc(4);
  typeLengthBytes.writeUInt32BE(typeBytes.length);
  
  const openSshKey = Buffer.concat([
    typeLengthBytes,
    typeBytes,
    keyLengthBytes,
    keyBytes,
  ]);
  
  return {
    privateKey: privateKey.toString(),
    publicKey: `${type} ${openSshKey.toString('base64')}`,
  };
}
