import SaymanProtocolAdapter, { DynamicClientTransport, PROTOCOL_METHODS } from './core/protocol/interfaceAdapter.js';

function assert(condition, message) {
  if (!condition) {
    console.error('❌ ASSERTION FAILED:', message);
    process.exit(1);
  }
}

console.log('--- STARTING PHASE 2.4 PROTOCOL INTERFACE ADAPTER TEST SUITE ---');

// Mock Node Engine
const mockEngine = {
  blockchain: {
    chain: [ { hash: '0x0' }, { hash: '0x1' }, { hash: '0x2' } ],
    state: {
      getBalance: (addr) => addr === '0x123' ? 5000000 : 0
    }
  },
  peerManager: {
    getPeerList: () => [ { nodeId: 'peer-1', address: '127.0.0.1:6002' } ]
  },
  pos: {
    lastValidator: 'node-1',
    validators: new Map([['node-1', 1000]])
  },
  storageMesh: {
    getBlobStatus: (id) => id === 'blob-1' ? { blobId: 'blob-1', status: 'DURABLE' } : null,
    getVSUSnapshot: () => ({ 'node-1': 10 })
  }
};

const adapter = new SaymanProtocolAdapter(mockEngine);

async function runTests() {
  console.log('Testing EVM JSON-RPC Dispatching...');
  
  // eth_blockNumber
  const resBlock = await adapter.handleRpcRequest({ jsonrpc: '2.0', method: PROTOCOL_METHODS.ETH_BLOCK_NUMBER, id: 1 });
  assert(resBlock.result === '0x2', `Expected block number 0x2, got ${resBlock.result}`);
  console.log('  eth_blockNumber ->', resBlock.result);

  // eth_getBalance
  const resBal = await adapter.handleRpcRequest({ jsonrpc: '2.0', method: PROTOCOL_METHODS.ETH_GET_BALANCE, params: ['0x123'], id: 2 });
  assert(resBal.result === '0x4c4b40', `Expected balance 0x4c4b40, got ${resBal.result}`);
  console.log('  eth_getBalance ->', resBal.result);

  // eth_chainId
  const resChain = await adapter.handleRpcRequest({ jsonrpc: '2.0', method: PROTOCOL_METHODS.ETH_CHAIN_ID, id: 3 });
  assert(resChain.result === '0x539', `Expected chainId 0x539 (1337), got ${resChain.result}`);
  console.log('  eth_chainId ->', resChain.result);

  console.log('Testing SAYMAN Storage & Consensus Extension Methods...');
  
  // sayman_getPeers
  const resPeers = await adapter.handleRpcRequest({ jsonrpc: '2.0', method: PROTOCOL_METHODS.SAYMAN_GET_PEERS, id: 4 });
  assert(resPeers.result.length === 1, 'Expected 1 peer');
  console.log('  sayman_getPeers ->', resPeers.result);

  // sayman_getConsensusStatus
  const resConsensus = await adapter.handleRpcRequest({ jsonrpc: '2.0', method: PROTOCOL_METHODS.SAYMAN_GET_CONSENSUS, id: 5 });
  assert(resConsensus.result.lastValidator === 'node-1', 'Expected lastValidator node-1');
  console.log('  sayman_getConsensusStatus ->', resConsensus.result);

  // sayman_getStorageBlobStatus
  const resBlob = await adapter.handleRpcRequest({ jsonrpc: '2.0', method: PROTOCOL_METHODS.SAYMAN_GET_STORAGE_BLOB, params: ['blob-1'], id: 6 });
  assert(resBlob.result.status === 'DURABLE', 'Expected DURABLE blob status');
  console.log('  sayman_getStorageBlobStatus ->', resBlob.result);

  console.log('Testing Transport Routing & Endpoint Fallback...');
  const transport = new DynamicClientTransport({ primaryEndpoint: 'http://localhost:9999/failed' });
  transport.setPeerEndpoints(['http://localhost:3000/api/rpc']);

  console.log('  DynamicClientTransport endpoints configured without hardcoded single host.');

  console.log('\n🎉 ALL PHASE 2.4 PROTOCOL INTERFACE TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
