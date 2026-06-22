import crypto from 'crypto';
import elliptic from 'elliptic';
const EC = elliptic.ec;
const ec = new EC('secp256k1');

const pk = 'c250b8e252df03086969bfbe30116852acf6da3b957a022b7466872b23c3ac2b';
const kp = ec.keyFromPrivate(pk);
const pub = kp.getPublic('hex');
const from = crypto.createHash('sha256').update(pub).digest('hex').substring(0,40);
const to = 'a3839c1c16996435efae17dcee6ae7f99d24573b';

const tx = {
  id: crypto.randomUUID(),
  type: 'TRANSFER',
  timestamp: Date.now(),
  data: { from, to, amount: 50000 },
  gasLimit: 21000,
  gasPrice: 1,
  nonce: 1,
  gasUsed: 0
};

const hash = crypto.createHash('sha256').update(JSON.stringify({
  type: tx.type,
  timestamp: tx.timestamp,
  data: tx.data,
  gasLimit: tx.gasLimit,
  gasPrice: tx.gasPrice,
  nonce: tx.nonce
})).digest('hex');

const sig = kp.sign(hash);
tx.signature = { r: sig.r.toString('hex'), s: sig.s.toString('hex') };
tx.publicKey = pub;

const res = await fetch('https://sayman.up.railway.app/api/broadcast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(tx)
});
console.log(await res.json());
