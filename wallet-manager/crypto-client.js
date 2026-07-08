// ============================================================
//  Sayman Crypto Client — Elliptic Curve & Wallet Core
// ============================================================

function toBase58(buffer) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let digits = [0];
    for (let i = 0; i < buffer.length; i++) {
        let carry = buffer[i];
        for (let j = 0; j < digits.length; j++) {
            carry += digits[j] << 8;
            digits[j] = carry % 58;
            carry = Math.floor(carry / 58);
        }
        while (carry > 0) {
            digits.push(carry % 58);
            carry = Math.floor(carry / 58);
        }
    }
    let string = '';
    for (let k = 0; k < buffer.length && buffer[k] === 0; k++) {
        string += ALPHABET[0];
    }
    for (let q = digits.length - 1; q >= 0; q--) {
        string += ALPHABET[digits[q]];
    }
    return string;
}

class SaymanWallet {
    constructor(privateKey = null, chain = 'sayman') {
        this.privateKey = privateKey;
        this.chain = chain || 'sayman';
        this.publicKey = null;
        this.address = null;
        this.ec = new elliptic.ec('secp256k1');
    }
  
    async initialize() {
        if (this.privateKey) {
            const keyPair = this.ec.keyFromPrivate(this.privateKey, 'hex');
            this.publicKey = keyPair.getPublic('hex');
        } else {
            const keyPair = this.ec.genKeyPair();
            this.privateKey = keyPair.getPrivate('hex');
            this.publicKey = keyPair.getPublic('hex');
        }
  
        const keyPair = this.ec.keyFromPrivate(this.privateKey, 'hex');

        if (this.chain === 'ethereum' || this.chain === 'arbitrum') {
            const pubHex = keyPair.getPublic(false, 'hex'); // uncompressed
            const pubBytes = new Uint8Array(pubHex.substring(2).match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const hashBuffer = await crypto.subtle.digest('SHA-256', pubBytes);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            this.address = '0x' + hashArray.slice(12).map(b => b.toString(16).padStart(2, '0')).join('');
        } else if (this.chain === 'bitcoin') {
            const pubHex = keyPair.getPublic(true, 'hex'); // compressed
            const pubBytes = new Uint8Array(pubHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const hash1 = await crypto.subtle.digest('SHA-256', pubBytes);
            const ripemd160_mock = new Uint8Array(hash1).slice(0, 20);
            
            const payload = new Uint8Array(21);
            payload[0] = 0x00; // Bitcoin Mainnet legacy address version byte
            payload.set(ripemd160_mock, 1);
            
            const dHash1 = await crypto.subtle.digest('SHA-256', payload);
            const dHash2 = await crypto.subtle.digest('SHA-256', dHash1);
            const checksum = new Uint8Array(dHash2).slice(0, 4);
            
            const finalPayload = new Uint8Array(25);
            finalPayload.set(payload);
            finalPayload.set(checksum, 21);
            
            this.address = toBase58(finalPayload);
        } else if (this.chain === 'solana') {
            const pubHex = keyPair.getPublic(true, 'hex'); // compressed
            const pubBytes = new Uint8Array(pubHex.substring(2, 66).match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            this.address = toBase58(pubBytes);
        } else {
            // Default: Sayman format (40 character hex)
            const encoder = new TextEncoder();
            const data = encoder.encode(this.publicKey);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            this.address = hashHex.substring(0, 40);
        }
  
        return this;
    }
  
    async signTransaction(txData) {
        const keyPair = this.ec.keyFromPrivate(this.privateKey, 'hex');
  
        const dataToHash = JSON.stringify({
            type: txData.type,
            timestamp: txData.timestamp,
            data: txData.data,
            gasLimit: txData.gasLimit,
            gasPrice: txData.gasPrice,
            nonce: txData.nonce
        });
  
        const encoder = new TextEncoder();
        const data = encoder.encode(dataToHash);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
        const signature = keyPair.sign(hash);
        return signature.toDER('hex');
    }
  
    export() {
        return {
            privateKey: this.privateKey,
            publicKey: this.publicKey,
            address: this.address
        };
    }
}

window.SaymanWallet = SaymanWallet;
console.log('🔐 Sayman Crypto Client loaded.');