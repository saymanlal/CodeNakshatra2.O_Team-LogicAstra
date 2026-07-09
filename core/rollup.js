import fetch from 'node-fetch';
import Transaction from './transaction.js';
import Wallet from '../wallet/wallet.js';

export async function submitRollupToL1(block, config) {
  const l1RpcUrl = process.env.L1_RPC_URL || 'http://localhost:10000';
  const l1BridgeAddress = process.env.L1_BRIDGE_CONTRACT;
  const l1PrivateKey = process.env.L1_SEQUENCER_PRIVATE_KEY;

  if (!l1BridgeAddress || !l1PrivateKey) {
    console.log(`[L2 Rollup] ⚠️ Skipping L1 commitment. L1_BRIDGE_CONTRACT or L1_SEQUENCER_PRIVATE_KEY env vars not configured.`);
    return;
  }

  console.log(`[L2 Rollup] 📤 Submitting L2 State Root Commitment for block #${block.index} to L1 Bridge at ${l1BridgeAddress}...`);

  try {
    const wallet = new Wallet(l1PrivateKey);
    const l1Address = wallet.address;

    // Fetch sequencer's nonce on L1
    const accountRes = await fetch(`${l1RpcUrl}/api/address/${l1Address}`)
      .then(r => r.json())
      .catch(() => null);

    if (!accountRes) {
      console.error(`[L2 Rollup] ❌ Failed to fetch sequencer L1 account details from ${l1RpcUrl}`);
      return;
    }

    const nonce = accountRes.nonce || 0;

    // Create the CONTRACT_CALL transaction to commit L2 state root to the L1 bridge
    const tx = Transaction.createContractCall(
      l1Address,
      l1BridgeAddress,
      'commitState',
      {
        chainId: config.chainId,
        blockIndex: block.index,
        stateRoot: block.stateRoot,
        txCount: block.transactions.length
      }
    );

    // Set gas parameters
    tx.gasLimit = 150_000;
    tx.gasPrice = 1;
    tx.nonce = nonce;
    tx.sign(wallet);

    // Broadcast transaction to L1 RPC node
    const broadcastRes = await fetch(`${l1RpcUrl}/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx.toJSON())
    }).then(r => r.json()).catch(err => ({ error: err.message }));

    if (broadcastRes.success) {
      console.log(`[L2 Rollup] ✅ State committed on L1! L1 TX Hash: ${broadcastRes.txId}`);
    } else {
      console.error(`[L2 Rollup] ❌ L1 Commitment failed: ${broadcastRes.error || JSON.stringify(broadcastRes)}`);
    }
  } catch (err) {
    console.error('[L2 Rollup] ❌ Rollup submission error:', err.message);
  }
}
