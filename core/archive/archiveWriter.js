import fs from 'fs';
import path from 'path';

export class ArchiveWriter {
  constructor(githubClient, repoManager, blockchain) {
    this.githubClient = githubClient;
    this.repoManager  = repoManager;
    this.blockchain   = blockchain;
    this.config       = blockchain.config;

    this.batchSize    = this.config.archive.batchSize    || 100;
    this.minBatch     = this.config.archive.archiveMinBatch || 10;
    this.checkpointPath = path.resolve(
      this.config.archive.migrationCheckpoint || './data/migration-checkpoint.json'
    );
    this.lastArchivedBlock = -1;
    this.isRunning         = false;

    // Concurrency / backoff
    this.isProcessing  = false;
    this.scheduleTimeout = null;
    this.retryDelay    = 5000;
    this.maxRetryDelay = 5 * 60 * 1000;
  }

  async start() {
    this.loadCheckpoint();
    this.isRunning = true;
    console.log(`[ArchiveWriter] Started. Last archived block: ${this.lastArchivedBlock}`);
    this.schedulePendingChunk(3000);
  }

  loadCheckpoint() {
    if (fs.existsSync(this.checkpointPath)) {
      try {
        const cp = JSON.parse(fs.readFileSync(this.checkpointPath, 'utf8'));
        this.lastArchivedBlock = cp.lastArchivedBlock ?? -1;
      } catch {}
    }
  }

  saveCheckpoint() {
    try {
      let cp = {};
      if (fs.existsSync(this.checkpointPath)) {
        cp = JSON.parse(fs.readFileSync(this.checkpointPath, 'utf8'));
      }
      cp.lastArchivedBlock = this.lastArchivedBlock;
      fs.writeFileSync(this.checkpointPath, JSON.stringify(cp, null, 2));
    } catch (err) {
      console.error('[ArchiveWriter] Checkpoint write failed:', err.message);
    }
  }

  queueBlock(block) {
    if (!this.isRunning) return;
    if (this.blockchain.isSyncing) return;
    // Schedule a flush check when a new block arrives
    this.schedulePendingChunk(200);
  }

  schedulePendingChunk(delay = 0) {
    if (!this.isRunning || this.isProcessing || this.blockchain.isSyncing) return;
    if (this.scheduleTimeout) clearTimeout(this.scheduleTimeout);
    this.scheduleTimeout = setTimeout(() => {
      this.scheduleTimeout = null;
      this.writePendingChunk().catch(err => {
        console.error('[ArchiveWriter] Error:', err.message);
      });
    }, delay);
  }

  async writePendingChunk() {
    if (this.isProcessing || !this.isRunning || this.blockchain.isSyncing) return;

    const start    = this.lastArchivedBlock + 1;
    const chainLen = this.blockchain.chain.length;
    const available = chainLen - start;        // how many new blocks exist

    // Need at least minBatch blocks to push (unless we have a full batch ready)
    if (available < this.minBatch) {
      // Schedule a check later
      this.schedulePendingChunk(30_000);
      return;
    }

    this.isProcessing = true;

    // Pick chunk boundaries: use full batchSize if possible, else take all available
    const end = start + Math.min(this.batchSize, available) - 1;

    const blocks = [];
    for (let i = start; i <= end; i++) {
      try {
        const rawBlock = await this.blockchain.db.get(`block:${i}`);
        if (!rawBlock) break;
        blocks.push(typeof rawBlock === 'string' ? JSON.parse(rawBlock) : rawBlock);
      } catch {
        break; // block not in DB yet
      }
    }

    if (blocks.length < this.minBatch) {
      this.isProcessing = false;
      this.schedulePendingChunk(30_000);
      return;
    }

    const actualEnd = start + blocks.length - 1;
    console.log(`[ArchiveWriter] Archiving blocks ${start}–${actualEnd} (${blocks.length} blocks)…`);

    try {
      await this.repoManager.checkAndRotate(start);

      const { buildChunkMerkleTree, verifyChunk } = await import('./merkleVerify.js');
      const tree      = buildChunkMerkleTree(blocks);
      const merkleRoot = tree.getRoot();

      const chunk = { startHeight: start, endHeight: actualEnd, merkleRoot, blocks };

      const isValid = await verifyChunk(chunk);
      if (!isValid) {
        console.error(`[ArchiveWriter] Chunk ${start}–${actualEnd} failed Merkle verification. Aborting.`);
        this.isProcessing = false;
        this.retryDelay   = Math.min(this.retryDelay * 2, this.maxRetryDelay);
        this.schedulePendingChunk(this.retryDelay);
        return;
      }

      const repo = this.repoManager.currentRepo;

      // Write chunk
      await this.githubClient.queueWrite(
        `chunks/chunk_${start}_${actualEnd}.json`,
        chunk,
        repo
      );

      // Write state snapshot at chunk boundary
      const stateSnap = this.blockchain.state.exportState();
      await this.githubClient.queueWrite(
        `snapshots/state_${actualEnd}.json`,
        stateSnap,
        repo
      );

      // Update latest pointer
      await this.githubClient.queueWrite(
        'snapshots/latest.json',
        { height: actualEnd, repo },
        repo
      );

      // Flush immediately so the commit goes out
      await this.githubClient.flush();

      this.lastArchivedBlock = actualEnd;
      this.saveCheckpoint();
      this.retryDelay = 5000; // reset backoff
      console.log(`[ArchiveWriter] ✅ Archived blocks ${start}–${actualEnd} → github:sayman-archive`);

      this.isProcessing = false;
      // Check if another chunk is ready right away
      this.schedulePendingChunk(0);

    } catch (err) {
      console.error(`[ArchiveWriter] Write failed for ${start}–${actualEnd}: ${err.message}`);
      this.isProcessing = false;
      this.retryDelay   = Math.min(this.retryDelay * 2, this.maxRetryDelay);
      this.schedulePendingChunk(this.retryDelay);
    }
  }

  async flushQueue() {
    try { await this.githubClient.flush(); } catch {}
  }
}
