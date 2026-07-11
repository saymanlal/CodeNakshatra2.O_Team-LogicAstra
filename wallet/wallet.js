import crypto from 'crypto';
import elliptic from 'elliptic';

const EC = elliptic.ec;
const ec = new EC('secp256k1');

class Wallet {
    constructor(privateKeyHex = null) {
        if (privateKeyHex) {
            this.keyPair = ec.keyFromPrivate(privateKeyHex, 'hex');
            this.privateKey = privateKeyHex;
        } else {
            this.keyPair = ec.genKeyPair();
            this.privateKey = this.keyPair.getPrivate('hex');
        }
        this.publicKey = this.keyPair.getPublic('hex');
        this.address = this.deriveAddress(this.publicKey);
    }

    deriveAddress(publicKey) {
        const hash = crypto
            .createHash('sha256')
            .update(publicKey)
            .digest('hex');
        return hash.substring(0, 40);
    }

    sign(hash) {
        const sig = this.keyPair.sign(hash);
        return {
            r: sig.r.toString('hex'),
            s: sig.s.toString('hex')
        };
    }

    static verifySignature(publicKey, signature, hash) {
        const key = ec.keyFromPublic(publicKey, 'hex');
        return key.verify(hash, signature);
    }
}

export default Wallet;