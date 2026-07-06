class SaymanWallet {
  constructor(privateKey = null) {
    this.ec = null;
    this.keyPair = null;
    this.privateKey = privateKey;
    this.publicKey = null;
    this.address = null;
  }

  async initialize() {
    await this.waitForElliptic();

    if (this.privateKey) {
      this.keyPair = this.ec.keyFromPrivate(this.privateKey, 'hex');
    } else {
      this.keyPair = this.ec.genKeyPair();
      this.privateKey = this.keyPair.getPrivate('hex');
    }

    this.publicKey = this.keyPair.getPublic('hex');
    this.address = await this.deriveAddress(this.publicKey);

    return this;
  }

  async waitForElliptic() {
    while (typeof elliptic === 'undefined') {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    this.ec = new elliptic.ec('secp256k1');
  }

  async deriveAddress(publicKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(publicKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 40);
  }

  async signTransaction(txData) {
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

    const signature = this.keyPair.sign(hash);
    return signature.toDER('hex');
  }

  export() {
    return {
      address: this.address,
      publicKey: this.publicKey,
      privateKey: this.privateKey
    };
  }
}

window.SaymanWallet = SaymanWallet;