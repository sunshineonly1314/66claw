const pemKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkDtHShdtjfCopovpCcIR
hiyFHopWsclr+7JQ+c4Iz2NIdWrCoAkSUTSp24fJXmVQh27m8Eq9JvGX/wMpQ8H6
++IpO06BXCyk1gYqf8Qqa6CdGMQ0aygCq6aTebQQqDBGICH7u985fkdTRDz62xyG
UbYKIJPZkRycZCGZ5pMvwhxKcSZ6ifpGuBhAlxLqHpax9sUgstWWBOMWEr7SpbL0
BE081ASxkXuQSSGDQFQzUZ98ZoVoYOmneIjU/6JHOAhLDA1R9qEy7KKpb3FV0DQm
PWgG9tgLZk1M7yp3xitO98ZrMtWLmNNPUtQvfM1vlvRI7It0BoGVnPq5P+9dvzmS
nQIDAQAB
-----END PUBLIC KEY-----`;

const xorKey = [0x5A, 0x3C, 0x7E, 0x1B, 0xA9, 0xF4, 0x62, 0xD8, 0x4F, 0x91, 0x23, 0xB7, 0xE5, 0x08, 0xCC, 0x6A];

const buf = Buffer.from(pemKey, 'utf-8');
const encrypted = Buffer.alloc(buf.length);
for (let i = 0; i < buf.length; i++) {
  encrypted[i] = buf[i] ^ xorKey[i % xorKey.length];
}

// Output as C hex array, 12 bytes per line
let result = '';
for (let i = 0; i < encrypted.length; i++) {
  if (i % 12 === 0) result += '  ';
  result += '0x' + encrypted[i].toString(16).toUpperCase().padStart(2, '0') + ',';
  if (i % 12 === 11) result += '\n';
  else result += ' ';
}
console.log('Total bytes:', encrypted.length);
console.log('');
console.log(result);
console.log('');

// Verify decryption
const decrypted = Buffer.alloc(encrypted.length);
for (let i = 0; i < encrypted.length; i++) {
  decrypted[i] = encrypted[i] ^ xorKey[i % xorKey.length];
}
console.log('Verify decrypted starts with:', decrypted.toString('utf-8').substring(0, 27));
console.log('Verify decrypted ends with:', decrypted.toString('utf-8').substring(decrypted.length - 25));
