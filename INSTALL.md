# Sayman Phase 21 - Complete Installation Guide

## Prerequisites

- **Node.js**: v20.0.0 or higher
- **npm**: v9.0.0 or higher
- **Git**: For cloning repository
- **Terminal**: Bash/Zsh (Linux/Mac) or WSL (Windows)

Check versions:
```bash
node --version    # Should be >= 20.0.0
npm --version     # Should be >= 9.0.0
```

---

## Quick Start (5 Minutes)
```bash
# 1. Clone or navigate to project
cd sayman-blockchain

# 2. Install dependencies
npm install

# 3. Run testnet
npm run testnet

# 4. Open browser
# http://localhost:3000

# 5. Install CLI (optional)
npm run install-cli
```

---

## Detailed Installation

### Step 1: Install Node.js

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Mac:**
```bash
brew install node@20
```

**Windows:**
Download from: https://nodejs.org/

### Step 2: Clone Project
```bash
git clone https://github.com/yourusername/sayman-blockchain.git
cd sayman-blockchain
```

Or if you have the files:
```bash
cd sayman-blockchain
```

### Step 3: Install Dependencies
```bash
npm install
```

This installs:
- `express` - Web server
- `elliptic` - Cryptography
- `level` - Database
- `uuid` - IDs
- `ws` - WebSocket
- `node-fetch` - HTTP client

### Step 4: Install CLI Tool (Optional)
```bash
npm run install-cli
```

Or manually:
```bash
cd cli
npm install
npm link
cd ..
```

Verify:
```bash
sayman --version
# Should show: 16.0.0
```

---

## Running the Network

### Testnet (Default)
```bash
npm run testnet
```

**Output:**
```
╔════════════════════════════════════════╗
║   SAYMAN BLOCKCHAIN - PHASE 21         ║
║   EVM Wallet & Parallel Archive Sync   ║
╚════════════════════════════════════════╝

🌐 NETWORK: TESTNET
📛 Network Name: Sayman Testnet
🔗 Chain ID: sayman-testnet-1
⛽ Gas: ENABLED
🚰 Faucet: ENABLED ✅

✅ API server running on http://localhost:3000
```

### Mainnet
```bash
npm run mainnet
```

Differences:
- No faucet
- Higher minimum stake
- Longer block time
- Production settings

### Multi-Node Network

**Terminal 1 (Bootstrap):**
```bash
npm run node1
```

**Terminal 2 (Peer 1):**
```bash
npm run node2
```

**Terminal 3 (Peer 2):**
```bash
npm run node3
```

Access:
- Node 1: http://localhost:3000
- Node 2: http://localhost:3001
- Node 3: http://localhost:3002

---

## Using the CLI

### First Time Setup
```bash
# Create wallet
sayman wallet create

# Output:
# ✅ Wallet created successfully!
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Address:     abc123...def456
# Private Key: 0x1234567890abcdef...
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ⚠️  Never share your private key with anyone!

# Your wallet is saved at: ~/.sayman/wallet.json
```

### Get Test Tokens (Testnet Only)

**Via CLI:**
```bash
# Get your address
sayman wallet info

# Request from faucet (via browser or curl)
curl -X POST http://localhost:3000/api/faucet \
  -H "Content-Type: application/json" \
  -d '{"address":"YOUR_ADDRESS"}'
```

**Via UI:**
- Open http://localhost:3000
- Click "Faucet"
- Paste your address
- Click "Claim 1000 SAYN"

### Check Balance
```bash
sayman balance

# Output:
# ━━━ Account Balance ━━━
# Address:  abc123...
# Balance:  1000 SAYN
# Staked:   0 SAYN
# Nonce:    0
# ━━━━━━━━━━━━━━━━━━━━━━
```

### Send Tokens
```bash
sayman send 0xRECIPIENT_ADDRESS 100

# With custom gas:
sayman send 0xRECIPIENT_ADDRESS 100 --gas-limit 50000 --gas-price 2

# Output:
# ━━━ Transaction Details ━━━
# From:      abc123...
# To:        def456...
# Amount:    100 SAYN
# Gas Limit: 50000
# Gas Price: 2
# Max Cost:  100.0001 SAYN
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ Transaction broadcast successfully!
# TX ID: 550e8400-e29b-41d4-a716-446655440000
```

### Stake Tokens
```bash
sayman stake 500

# Output:
# ━━━ Staking Transaction ━━━
# Address:   abc123...
# Amount:    500 SAYN
# Gas Limit: 100000
# Gas Price: 1
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ Stake transaction broadcast!
# You will become a validator once the block is mined.
```

### View Network
```bash
sayman network

# Output:
# ━━━ Network Information ━━━
# Network:     Sayman Testnet
# Chain ID:    sayman-testnet-1
# Block Height:150
# Validators:  4
# Total Stake: 2000 SAYN
# Block Time:  5s
# Block Reward:10 SAYN
# Min Stake:   100 SAYN
# Faucet:      ✓ Enabled
```

### List Validators
```bash
sayman validators

# Output:
# ━━━ Active Validators ━━━
# ┌────────────────┬───────────┬──────┬────────┐
# │ Address        │ Stake     │ %    │ Missed │
# ├────────────────┼───────────┼──────┼────────┤
# │ abc123...      │ 500 SAYN  │ 25%  │ 0      │
# │ def456...      │ 300 SAYN  │ 15%  │ 1      │
# │ ghi789...      │ 1200 SAYN │ 60%  │ 0      │
# └────────────────┴───────────┴──────┴────────┘
```

---

## Using the Web UI

### Dashboard

Open http://localhost:3000

Features:
- Live network statistics
- Real-time block feed (updates every 5s)
- Validator monitoring
- Gas usage tracking

### Create Wallet

1. Click "Wallet" tab
2. Click "Create New Wallet"
3. **SAVE YOUR PRIVATE KEY!**
4. Copy your address

### Get Test Tokens

1. Click "Faucet" tab
2. Paste your address
3. Click "Claim 1000 SAYN"
4. Wait ~6 seconds for block

### Send Transaction

1. Click "Wallet" tab
2. Scroll to "Send SAYN"
3. Enter recipient address
4. Enter amount
5. Enter your private key
6. Click "Send Transaction"

**Note:** Gas is calculated automatically.

### Stake

1. Click "Wallet" tab
2. Scroll to "Stake SAYN"
3. Enter amount (min: 100 SAYN)
4. Enter your private key
5. Click "Stake"

### Deploy Contract

1. Click "Contracts" tab
2. Write contract code:
```javascript
function increment() {
  state.count = (state.count || 0) + 1;
}

function getCount() {
  return state.count || 0;
}
```
3. Enter your private key
4. Click "Deploy Contract"
5. Wait for confirmation

### Call Contract

1. After deployment, copy contract address
2. Scroll to "Call Contract"
3. Paste contract address
4. Enter method: `increment`
5. Arguments: `{}`
6. Enter private key
7. Click "Call Contract"

---

## Generate Documentation
```bash
npm run docs
```

Generates `NETWORK_INFO.md` in the root directory with:
- Current network stats
- Gas configuration
- Validator list
- API reference
- Economics data

---

## Testing

### Run Automated Tests
```bash
chmod +x test-phase6.sh
./test-phase6.sh
```

Tests:
- ✅ Network configuration
- ✅ Gas model
- ✅ Nonce system
- ✅ API endpoints
- ✅ Documentation generator
- ✅ Mempool limits
- ✅ Validators
- ✅ Contracts

### Manual Testing

**1. Test Wallet:**
```bash
sayman wallet create
sayman balance
```

**2. Test Transactions:**
```bash
# Get test tokens first (via faucet)
sayman send 0xTEST_ADDRESS 10
```

**3. Test Staking:**
```bash
sayman stake 100
sayman validators
```

**4. Test Gas Estimation:**
```bash
sayman estimate TRANSFER '{"from":"0x...","to":"0x...","amount":100}'
```

**5. Test Nonce:**
```bash
# Check nonce
sayman balance
# Shows: Nonce: 0

# Send transaction
sayman send 0x... 10
# Nonce increments to 1

# Check again
sayman balance
# Shows: Nonce: 1
```

---

## Configuration

### Change API Endpoint (CLI)
```bash
sayman config http://localhost:3001/api
```

### Environment Variables
```bash
# Change port
PORT=4000 npm run testnet

# Change P2P port
P2P_PORT=7001 npm run testnet

# Add peers
PEERS=ws://peer1:6001,ws://peer2:6002 npm run testnet

# Use mainnet
NODE_ENV=mainnet npm start
```

### Custom Network

Edit `config/testnet.js` or `config/mainnet.js`:
```javascript
export default {
  networkName: 'My Custom Network',
  chainId: 'custom-1',
  blockTime: 3000,      // 3 seconds
  blockReward: 20,      // 20 SAYN
  minStake: 50,         // 50 SAYN minimum
  faucetEnabled: true,
  faucetAmount: 2000,   // 2000 SAYN per request
  
  // Gas configuration
  gasLimits: {
    minGasPrice: 2,     // Higher minimum
    maxGasPerTx: 10000000
  }
};
```

---

## Troubleshooting

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Use different port
PORT=3001 npm run testnet

# Or kill process using port 3000
lsof -ti:3000 | xargs kill
```

### CLI Not Found
```
sayman: command not found
```

**Solution:**
```bash
# Reinstall CLI
cd cli
npm link

# Or use npx
npx sayman wallet create
```

### Database Corruption
```
Error: LEVEL_CORRUPTION
```

**Solution:**
```bash
# Delete and rebuild
rm -rf data/
npm start
```

### Out of Gas Errors
```
Error: Out of gas
```

**Solution:**
```bash
# Increase gas limit
sayman send 0x... 100 --gas-limit 100000

# Or estimate first
sayman estimate TRANSFER '{"from":"...","to":"...","amount":100}'
```

### Invalid Nonce
```
Error: Invalid nonce. Expected: 5, Got: 3
```

**Solution:**
```bash
# Check current nonce
sayman balance

# Transactions must be sequential
# If nonce is 5, next transaction must use nonce 5
```

### Rate Limit Exceeded
```
Error: Rate limit exceeded. Please wait.
```

**Solution:** Wait 1 minute and retry.

---

## Uninstalling

### Remove CLI
```bash
cd cli
npm unlink
```

### Remove Node Modules
```bash
rm -rf node_modules
rm -rf cli/node_modules
```

### Remove Database
```bash
rm -rf data/
```

### Remove Wallet
```bash
rm -rf ~/.sayman/
```

---

## Next Steps

### Learn More

1. Read `README.md` for detailed features
2. Check `NETWORK_INFO.md` for network details
3. Review smart contract examples
4. Explore API endpoints

### Join the Network

1. Run a validator node
2. Stake tokens
3. Deploy contracts
4. Help secure the network

### Contribute

1. Report issues
2. Submit improvements
3. Write documentation
4. Create tutorials

---

## Support

- **Documentation**: README.md
- **Network Info**: `npm run docs`
- **CLI Help**: `sayman --help`
- **Issues**: GitHub Issues

---

**Congratulations! You've successfully installed Sayman Phase 21.**

Start exploring with:
```bash
sayman network
sayman validators
sayman balance
```

Happy blockchain building! 🚀⛓️