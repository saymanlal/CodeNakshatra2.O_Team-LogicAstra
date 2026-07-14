import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_BASE = process.env.SAYMAN_API || 'http://localhost:3000/api';

async function generateDocs() {
  console.log('📝 Generating network documentation...\n');

  try {
    // Fetch network data
    const networkRes = await fetch(`${API_BASE}/network`);
    const network = await networkRes.json();

    const statsRes = await fetch(`${API_BASE}/stats`);
    const stats = await statsRes.json();

    const validatorsRes = await fetch(`${API_BASE}/validators`);
    const validators = await validatorsRes.json();

    // Generate markdown
    const markdown = `# ${network.network} - Network Information

**Generated:** ${new Date().toLocaleString()}  
**API Endpoint:** ${API_BASE}

---

## 🌐 Network Overview

| Parameter | Value |
|-----------|-------|
| **Network Name** | ${network.network} |
| **Chain ID** | \`${network.chainId}\` |
| **Current Block Height** | ${stats.blocks.toLocaleString()} |
| **Block Time** | ${(network.blockTime / 1000).toFixed(1)}s |
| **Block Reward** | ${network.blockReward} SAYN |
| **Minimum Stake** | ${network.minStake} SAYN |
| **Faucet Status** | ${network.faucetEnabled ? '✅ Enabled (Testnet)' : '❌ Disabled (Mainnet)'} |

---

## ⛽ Gas Model

### Gas Limits

| Parameter | Value |
|-----------|-------|
| **Minimum Gas Price** | ${network.gasLimits.minGasPrice} wei |
| **Max Gas Per Transaction** | ${network.gasLimits.maxGasPerTx.toLocaleString()} |
| **Max Gas Per Block** | ${network.gasLimits.maxGasPerBlock.toLocaleString()} |
| **Max Execution Time** | ${network.gasLimits.maxExecutionTime}ms |
| **Max State Size** | ${(network.gasLimits.maxStateSize / 1024).toFixed(0)}KB |
| **Max Instructions** | ${network.gasLimits.maxInstructions.toLocaleString()} |

### Gas Costs

| Transaction Type | Base Gas Cost |
|-----------------|---------------|
| **TRANSFER** | ${network.gasCosts.TRANSFER} |
| **STAKE** | ${network.gasCosts.STAKE} |
| **UNSTAKE** | ${network.gasCosts.STAKE} |
| **CONTRACT_DEPLOY** | ${network.gasCosts.CONTRACT_DEPLOY} + code size / 10 |
| **CONTRACT_CALL** | ${network.gasCosts.CONTRACT_CALL_BASE} + execution |
| **State Read** | ${network.gasCosts.STATE_READ} |
| **State Write** | ${network.gasCosts.STATE_WRITE} |

---

## 👥 Validators

**Total Active Validators:** ${validators.totalValidators}  
**Total Network Stake:** ${validators.totalStake.toLocaleString()} SAYN  
**Estimated APR:** ${validators.estimatedAPR}%

### Top Validators

| Address | Stake | Network % | Missed Blocks |
|---------|-------|-----------|---------------|
${validators.validators.slice(0, 10).map(v => 
  `| \`${v.address.substring(0, 16)}...\` | ${v.stake.toLocaleString()} SAYN | ${v.percentage}% | ${v.missedBlocks} |`
).join('\n')}

---

## 📜 Smart Contracts

**Total Deployed Contracts:** ${stats.contracts}

Contracts are executed in a sandboxed JavaScript VM with the following restrictions:
- Maximum execution time: ${network.gasLimits.maxExecutionTime}ms
- Maximum state size: ${(network.gasLimits.maxStateSize / 1024).toFixed(0)}KB
- Maximum instructions: ${network.gasLimits.maxInstructions.toLocaleString()}
- No access to: require, process, filesystem, network

---

## 🔐 Security Features

### Anti-Spam Protections

- ✅ **Nonce System**: Sequential nonce per address prevents replay attacks
- ✅ **Gas Fees**: Economic cost to submit transactions
- ✅ **Mempool Limit**: Maximum 1,000 pending transactions
- ✅ **Rate Limiting**: Max 10 transactions per minute per address
- ✅ **Minimum Gas Price**: ${network.gasLimits.minGasPrice} wei

### Consensus Security

- ✅ **Proof of Stake**: ${validators.totalValidators} active validators
- ✅ **Minimum Stake**: ${network.minStake} SAYN required
- ✅ **Slashing**: Validators penalized for missed blocks
- ✅ **Chain ID Validation**: Prevents cross-network attacks

---

## 💰 Economics

### Token Supply

- **Max Supply**: 21,000,000 SAYN
- **Block Reward**: ${network.blockReward} SAYN per block
- **Blocks Per Day**: ${(86400000 / network.blockTime).toFixed(0)}
- **Daily Emission**: ${((86400000 / network.blockTime) * network.blockReward).toFixed(0)} SAYN

### Staking

- **Minimum Stake**: ${network.minStake} SAYN
- **Total Staked**: ${validators.totalStake.toLocaleString()} SAYN
- **Estimated APR**: ${validators.estimatedAPR}%
- **Unstake Delay**: Variable (configured per network)

---

## 🔧 API Endpoints

**Base URL:** \`${API_BASE}\`

### Core Endpoints

- \`GET /network\` - Network configuration
- \`GET /stats\` - Network statistics
- \`GET /blocks\` - List blocks (paginated)
- \`GET /blocks/:index\` - Get specific block
- \`GET /transactions/:id\` - Get transaction
- \`GET /address/:address\` - Get address info
- \`GET /validators\` - List validators
- \`GET /contracts\` - List contracts
- \`POST /broadcast\` - Submit signed transaction
- \`POST /estimate-gas\` - Estimate gas cost

### Search

- \`GET /search/:query\` - Search by block/tx/address

---

## 📱 CLI Usage

Install the CLI tool:

\`\`\`bash
cd cli
npm install
npm link
\`\`\`

### Commands

\`\`\`bash
# Wallet
sayman wallet create
sayman wallet import <privateKey>
sayman balance [address]

# Transactions
sayman send <to> <amount>
sayman stake <amount>
sayman unstake

# Contracts
sayman deploy <file.js>
sayman call <contract> <method> [args]

# Network
sayman network
sayman validators
sayman estimate <type> <data>
\`\`\`

---

## 🚀 Getting Started

### 1. Run a Node

\`\`\`bash
# Testnet
npm run testnet

# Mainnet
npm run mainnet
\`\`\`

### 2. Create Wallet

\`\`\`bash
sayman wallet create
\`\`\`

### 3. Get Test Tokens (Testnet Only)

\`\`\`bash
curl -X POST ${API_BASE}/faucet \\
  -H "Content-Type: application/json" \\
  -d '{"address":"YOUR_ADDRESS"}'
\`\`\`

### 4. Stake and Become Validator

\`\`\`bash
sayman stake ${network.minStake}
\`\`\`

---

## 📊 Current Status

- **Network Health**: ✅ Operational
- **Block Height**: ${stats.blocks.toLocaleString()}
- **Active Validators**: ${validators.totalValidators}
- **Network Stake**: ${validators.totalStake.toLocaleString()} SAYN
- **Mempool Size**: ${stats.mempool}

---

*This document is auto-generated. Last updated: ${new Date().toLocaleString()}*
`;

    // Save to root folder
    const filePath = path.join(__dirname, '..', 'NETWORK_INFO.md');
    fs.writeFileSync(filePath, markdown);

    console.log('✅ Documentation generated successfully!');
    console.log(`📄 File: ${filePath}\n`);

  } catch (error) {
    console.error('❌ Error generating documentation:', error.message);
    process.exit(1);
  }
}

generateDocs();