import crypto from 'crypto';
import elliptic from 'elliptic';
import { keccak256 } from 'js-sha3';

const EC = elliptic.ec;
const ec = new EC('secp256k1');

// Simple RLP decoder
export function decodeRLP(buffer) {
  let offset = 0;
  
  function decodeItem() {
    if (offset >= buffer.length) {
      throw new Error('RLP decode error: Out of bounds');
    }
    const prefix = buffer[offset];
    if (prefix < 0x80) {
      offset++;
      return Buffer.from([prefix]);
    } else if (prefix <= 0xb7) {
      const len = prefix - 0x80;
      offset++;
      const data = buffer.subarray(offset, offset + len);
      offset += len;
      return data;
    } else if (prefix <= 0xbf) {
      const lenLen = prefix - 0xb7;
      offset++;
      let len = 0;
      for (let i = 0; i < lenLen; i++) {
        len = (len << 8) + buffer[offset + i];
      }
      offset += lenLen;
      const data = buffer.subarray(offset, offset + len);
      offset += len;
      return data;
    } else if (prefix <= 0xf7) {
      const len = prefix - 0xc0;
      offset++;
      const end = offset + len;
      const list = [];
      while (offset < end) {
        list.push(decodeItem());
      }
      return list;
    } else {
      const lenLen = prefix - 0xf7;
      offset++;
      let len = 0;
      for (let i = 0; i < lenLen; i++) {
        len = (len << 8) + buffer[offset + i];
      }
      offset += lenLen;
      const end = offset + len;
      const list = [];
      while (offset < end) {
        list.push(decodeItem());
      }
      return list;
    }
  }
  
  return decodeItem();
}

// Simple RLP encoder
export function encodeRLP(item) {
  if (Buffer.isBuffer(item)) {
    if (item.length === 1 && item[0] < 0x80) {
      return item;
    }
    if (item.length <= 55) {
      const header = Buffer.from([0x80 + item.length]);
      return Buffer.concat([header, item]);
    }
    const lenBuf = getLengthBuffer(item.length);
    const header = Buffer.from([0xb7 + lenBuf.length]);
    return Buffer.concat([header, lenBuf, item]);
  } else if (Array.isArray(item)) {
    const encodedItems = item.map(encodeRLP);
    const payload = Buffer.concat(encodedItems);
    if (payload.length <= 55) {
      const header = Buffer.from([0xc0 + payload.length]);
      return Buffer.concat([header, payload]);
    }
    const lenBuf = getLengthBuffer(payload.length);
    const header = Buffer.from([0xf7 + lenBuf.length]);
    return Buffer.concat([header, lenBuf, payload]);
  } else if (typeof item === 'number') {
    if (item === 0) {
      return Buffer.from([0x80]);
    }
    let hex = item.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    return encodeRLP(Buffer.from(hex, 'hex'));
  } else if (typeof item === 'bigint') {
    if (item === 0n) {
      return Buffer.from([0x80]);
    }
    let hex = item.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    return encodeRLP(Buffer.from(hex, 'hex'));
  } else if (typeof item === 'string') {
    if (item.startsWith('0x')) {
      let hex = item.slice(2);
      if (hex.length % 2 !== 0) hex = '0' + hex;
      return encodeRLP(Buffer.from(hex, 'hex'));
    }
    return encodeRLP(Buffer.from(item, 'utf8'));
  }
  throw new Error('Unsupported item for RLP encoding');
}

function getLengthBuffer(length) {
  let hex = length.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return Buffer.from(hex, 'hex');
}

// Parses raw transaction hex
export function parseTransaction(hexTx) {
  if (hexTx.startsWith('0x')) hexTx = hexTx.slice(2);
  const rawBuf = Buffer.from(hexTx, 'hex');
  let typeByte = null;
  let rlpBuf = rawBuf;
  
  if (rawBuf[0] < 0x80) {
    // EIP-2718 type wrapper
    typeByte = rawBuf[0];
    rlpBuf = rawBuf.subarray(1);
  }
  
  const decoded = decodeRLP(rlpBuf);
  if (!Array.isArray(decoded)) {
    throw new Error('Invalid RLP transaction: not a list');
  }
  
  let nonce, gasPrice, gasLimit, to, value, data, v, r, s, chainId;
  
  if (typeByte === 2) {
    // EIP-1559: [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, v, r, s]
    chainId = decoded[0].length ? decoded[0].readUIntBE(0, decoded[0].length) : 0;
    nonce = decoded[1].length ? decoded[1].readUIntBE(0, decoded[1].length) : 0;
    const maxFeePerGas = decoded[3].length ? decoded[3].readUIntBE(0, decoded[3].length) : 0;
    gasPrice = maxFeePerGas; // fallback
    gasLimit = decoded[4].length ? decoded[4].readUIntBE(0, decoded[4].length) : 0;
    to = decoded[5].toString('hex');
    value = decoded[6].length ? BigInt('0x' + decoded[6].toString('hex')) : 0n;
    data = decoded[7];
    v = decoded[9].length ? decoded[9][0] : 0;
    r = decoded[10];
    s = decoded[11];
  } else if (typeByte === 1) {
    // EIP-2930: [chainId, nonce, gasPrice, gasLimit, to, value, data, accessList, v, r, s]
    chainId = decoded[0].length ? decoded[0].readUIntBE(0, decoded[0].length) : 0;
    nonce = decoded[1].length ? decoded[1].readUIntBE(0, decoded[1].length) : 0;
    gasPrice = decoded[2].length ? decoded[2].readUIntBE(0, decoded[2].length) : 0;
    gasLimit = decoded[3].length ? decoded[3].readUIntBE(0, decoded[3].length) : 0;
    to = decoded[4].toString('hex');
    value = decoded[5].length ? BigInt('0x' + decoded[5].toString('hex')) : 0n;
    data = decoded[6];
    v = decoded[8].length ? decoded[8][0] : 0;
    r = decoded[9];
    s = decoded[10];
  } else {
    // Legacy: [nonce, gasPrice, gasLimit, to, value, data, v, r, s]
    nonce = decoded[0].length ? decoded[0].readUIntBE(0, decoded[0].length) : 0;
    gasPrice = decoded[1].length ? decoded[1].readUIntBE(0, decoded[1].length) : 0;
    gasLimit = decoded[2].length ? decoded[2].readUIntBE(0, decoded[2].length) : 0;
    to = decoded[3].toString('hex');
    value = decoded[4].length ? BigInt('0x' + decoded[4].toString('hex')) : 0n;
    data = decoded[5];
    v = decoded[6].length ? decoded[6].readUIntBE(0, decoded[6].length) : 0;
    r = decoded[7];
    s = decoded[8];
  }
  
  if (to) {
    to = to.toLowerCase();
    if (to.startsWith('0x')) to = to.slice(2);
    to = to.padStart(40, '0');
  }

  return {
    typeByte,
    nonce,
    gasPrice,
    gasLimit,
    to: to || null,
    value: typeof value === 'bigint' ? value : BigInt(value),
    data: data.toString('hex'),
    v,
    r: r.toString('hex'),
    s: s.toString('hex'),
    rawBuf
  };
}

// Compute the EVM message hash of the transaction to verify signatures
export function calculateEVMHash(tx) {
  if (tx.typeByte === 2) {
    // EIP-1559
    const decoded = decodeRLP(tx.rawBuf.subarray(1));
    const fieldsToEncode = [
      decoded[0], // chainId
      decoded[1], // nonce
      decoded[2], // maxPriorityFeePerGas
      decoded[3], // maxFeePerGas
      decoded[4], // gasLimit
      decoded[5], // to
      decoded[6], // value
      decoded[7], // data
      decoded[8], // accessList
    ];
    const rlpEncoded = encodeRLP(fieldsToEncode);
    const payload = Buffer.concat([Buffer.from([0x02]), rlpEncoded]);
    return Buffer.from(keccak256(payload), 'hex');
  } else if (tx.typeByte === 1) {
    // EIP-2930
    const decoded = decodeRLP(tx.rawBuf.subarray(1));
    const fieldsToEncode = [
      decoded[0], // chainId
      decoded[1], // nonce
      decoded[2], // gasPrice
      decoded[3], // gasLimit
      decoded[4], // to
      decoded[5], // value
      decoded[6], // data
      decoded[7], // accessList
    ];
    const rlpEncoded = encodeRLP(fieldsToEncode);
    const payload = Buffer.concat([Buffer.from([0x01]), rlpEncoded]);
    return Buffer.from(keccak256(payload), 'hex');
  } else {
    // Legacy
    const decoded = decodeRLP(tx.rawBuf);
    const vVal = decoded[6].length ? decoded[6].readUIntBE(0, decoded[6].length) : 0;
    
    let chainId = 0;
    let isEIP155 = false;
    if (vVal > 28) {
      chainId = Math.floor((vVal - 35) / 2);
      isEIP155 = true;
    }
    
    let fieldsToEncode;
    if (isEIP155) {
      fieldsToEncode = [
        decoded[0], // nonce
        decoded[1], // gasPrice
        decoded[2], // gasLimit
        decoded[3], // to
        decoded[4], // value
        decoded[5], // data
        chainId,
        0,
        0
      ];
    } else {
      fieldsToEncode = [
        decoded[0], // nonce
        decoded[1], // gasPrice
        decoded[2], // gasLimit
        decoded[3], // to
        decoded[4], // value
        decoded[5]  // data
      ];
    }
    const rlpEncoded = encodeRLP(fieldsToEncode);
    return Buffer.from(keccak256(rlpEncoded), 'hex');
  }
}

// Recover standard secp256k1 public key from message hash and (r, s, v)
export function recoverPublicKey(msgHash, rHex, sHex, v, typeByte) {
  let recId;
  if (typeByte === 1 || typeByte === 2) {
    recId = v & 1;
  } else {
    if (v > 28) {
      recId = (v - 35) & 1;
    } else {
      recId = (v - 27) & 1;
    }
  }

  // Create BigNumber instances for r and s
  const rBN = new ec.curve.n.constructor(rHex, 16);
  const sBN = new ec.curve.n.constructor(sHex, 16);
  
  const pubKey = ec.recoverPubKey(msgHash, { r: rBN, s: sBN }, recId);
  return pubKey.encode('hex');
}

// Convert public key to Ethereum address format
export function getEthereumAddress(pubKeyHex) {
  const key = ec.keyFromPublic(pubKeyHex, 'hex');
  const pubBytes = Buffer.from(key.getPublic(false, 'hex'), 'hex'); // uncompressed 65 bytes
  const hash = keccak256(pubBytes.subarray(1)); // exclude 0x04
  return '0x' + hash.slice(-40); // last 20 bytes
}

// Map the chainId string to a numeric value for MetaMask
export function getNumericChainId(strChainId) {
  if (strChainId === 'sayman-mainnet-1') return 82921;
  if (strChainId === 'sayman-public-testnet-1') return 82922;
  if (strChainId === 'sayman-testnet-1') return 82923;
  
  const num = parseInt(strChainId.replace(/\D/g, ''), 10);
  if (!isNaN(num) && num > 0) return num;
  
  let hash = 0;
  for (let i = 0; i < strChainId.length; i++) {
    hash = (hash << 5) - hash + strChainId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 12345;
}

export function formatEVMBlock(block, includeTxs = false, blockchain) {
  const hexIndex = '0x' + block.index.toString(16);
  const blockHash = '0x' + block.hash;
  const parentHash = block.index > 0 ? '0x' + block.previousHash : '0x' + '0'.repeat(64);
  
  const txs = block.transactions.map((tx, idx) => {
    if (includeTxs) {
      return formatEVMTransaction(tx, block, blockchain, idx);
    } else {
      return '0x' + tx.id;
    }
  });

  return {
    number: hexIndex,
    hash: blockHash,
    parentHash: parentHash,
    nonce: '0x0000000000000000',
    sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
    logsBloom: '0x' + '0'.repeat(512),
    transactionsRoot: '0x' + (block.merkleRoot || '0'.repeat(64)),
    stateRoot: '0x' + (block.stateRoot || '0'.repeat(64)),
    miner: '0x' + (block.validator ? block.validator.padEnd(40, '0').slice(0, 40) : '0'.repeat(40)),
    difficulty: '0x1',
    totalDifficulty: '0x1',
    extraData: '0x',
    size: '0x' + JSON.stringify(block).length.toString(16),
    gasLimit: '0x5f5e100', // 100M
    gasUsed: '0x' + (block.transactions.reduce((acc, t) => acc + (t.gasUsed || 21000), 0)).toString(16),
    timestamp: '0x' + Math.floor(block.timestamp / 1000).toString(16), // in seconds
    transactions: txs,
    uncles: []
  };
}

export function formatEVMTransaction(tx, block = null, blockchain, txIndex = 0) {
  const fromAddr = tx.data.from ? (tx.data.from.startsWith('0x') ? tx.data.from : '0x' + tx.data.from) : '0x' + '0'.repeat(40);
  const toAddr = tx.data.to ? (tx.data.to.startsWith('0x') ? tx.data.to : '0x' + tx.data.to) : (tx.data.contractAddress ? (tx.data.contractAddress.startsWith('0x') ? tx.data.contractAddress : '0x' + tx.data.contractAddress) : null);
  
  const valueWei = BigInt(tx.data.amount || 0) * 10n**10n;
  const gasPriceWei = BigInt(tx.gasPrice || 1) * 10n**10n;

  return {
    hash: '0x' + tx.id,
    nonce: '0x' + (tx.nonce || 0).toString(16),
    blockHash: block ? '0x' + block.hash : null,
    blockNumber: block ? '0x' + block.index.toString(16) : null,
    transactionIndex: '0x' + txIndex.toString(16),
    from: fromAddr,
    to: toAddr,
    value: '0x' + valueWei.toString(16),
    gasPrice: '0x' + gasPriceWei.toString(16),
    gas: '0x' + (tx.gasLimit || 21000).toString(16),
    input: tx.isEVM && tx.evmRaw ? '0x' + parseTransaction(tx.evmRaw).data : (tx.data.code ? '0x' + tx.data.code : '0x'),
    v: tx.isEVM && tx.evmRaw ? '0x' + parseTransaction(tx.evmRaw).v.toString(16) : '0x1b',
    r: tx.isEVM && tx.evmRaw ? '0x' + parseTransaction(tx.evmRaw).r : '0x' + '0'.repeat(64),
    s: tx.isEVM && tx.evmRaw ? '0x' + parseTransaction(tx.evmRaw).s : '0x' + '0'.repeat(64)
  };
}
