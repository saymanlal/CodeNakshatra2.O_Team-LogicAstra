# SAYMAN Blockchain Archive Layer

This directory contains the additive, non-disruptive blockchain archiving system for the SAYMAN Network. It is designed to archive block data and state snapshots to GitHub repositories without impacting consensus, block production, or API performance.

## 📁 System Architecture

The archive system consists of 7 components:

1. **`githubClient.js`**: A rate-limited GitHub client utilizing `@octokit/rest` with throttling and retry plug-ins. Implements a token-bucket rate limiter, commit buffering (batching up to 10 files per commit, minimum 5 seconds between commits), and CDN (jsDelivr) read support.
2. **`repoManager.js`**: Monitors repository size (soft limit of 4.5 GB) and automatically rotates archives to new repositories (`sayman-archive-1`, `sayman-archive-2`, etc.) while maintaining a tamper-proof, hashed mapping registry.
3. **`merkleVerify.js`**: Cryptographically validates block continuity, transaction signatures, timestamp drift (max 1 hour), and chunk Merkle roots. Utilizes caching to speed up recurring verifications.
4. **`migration.js`**: Resumable migration engine that copies historical blocks and state snapshot data from LevelDB to the archive. Uses non-blocking scheduling (`setImmediate`) to run in the background with zero downtime.
5. **`archiveWriter.js`**: Listens to block production hooks and writes newly produced blocks to the archive asynchronously in batches of 1000 blocks.
6. **`archiveReader.js`**: Reads block chunks and state snapshots using a fast CDN primary provider, with automatic fallback to GitHub API and IPFS gateways. Utilizes disk and memory caching.
7. **`index.js`**: Export registry for all components.

---

## ⚙️ Configuration

Add the following block to your configuration file (e.g., `config/testnet.js`, `config/public-testnet.js`):

```javascript
archive: {
  enabled: true,
  githubOwner: 'saymanlal',
  githubRepo: 'sayman-archive',
  githubBranch: 'main',
  githubToken: process.env.GITHUB_TOKEN,  // MUST be set in environment variables
  batchSize: 1000,
  compressionEnabled: true,
  useCDN: true,
  ipfsGateway: null,  // e.g., 'https://ipfs.io/ipfs/' (optional)
  migrationCheckpoint: './data/migration-checkpoint.json'
}
```

---

## 🚀 Deployment Instructions

### 1. Install Dependencies
Run the following command at the root of the project:
```bash
npm install @octokit/rest @octokit/plugin-throttling @octokit/plugin-retry
```

### 2. Configure GitHub Access
Ensure that a Personal Access Token (PAT) with repository read/write access is set up:
```bash
export GITHUB_TOKEN="your-github-token-here"
```

### 3. Run Node
Start your node as usual. On startup, the system will automatically check if migration is needed, complete it in the background, and transition to continuous archiving:
```bash
npm run testnet
```

---

## 🛡️ Rollback Plan

If any issue arises with the archive layer, you can safely disable or remove it with zero risk to the blockchain consensus state.

### Option A: Configuration Flag (Recommended)
Simply change the `enabled` flag to `false` in your active network configuration file:
```javascript
archive: {
  enabled: false,
  ...
}
```

### Option B: Code Rollback
To completely remove the archive layer from the codebase, revert the following modifications:

1. **`core/blockchain.js`**:
   - Revert imports of `./archive/index.js`.
   - Remove archive initialization in the constructor.
   - Remove the `archiveWriter.queueBlock(block)` hook from `addBlock()`.
   - Remove the `archiveWriter.flushQueue()` hook from `saveChain()`.
   - Remove the `syncFromArchive()` method from `Blockchain` class.

2. **`server.js`**:
   - Revert imports of `./core/archive/index.js`.
   - Remove the `runMigration` check and `blockchain.archiveWriter.start()` call.

3. **Delete Archive Directory**:
   - Delete the `core/archive` directory.
