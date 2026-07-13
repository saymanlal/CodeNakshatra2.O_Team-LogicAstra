import fs from 'fs';
import path from 'path';

export class ArchiveWriter {
  constructor(githubClient, repoManager, blockchain) {
    this.githubClient = githubClient;
    this.repoManager = repoManager;
    this.blockchain = blockchain;
    this.config = blockchain.config;

    this.batchSize = this.config.archive.batchSize || 1000;
    this.checkpointPath = path.resolve(this.config.archive.migrationCheckpoint || './data/migration-checkpoint.json');
    this.lastArchivedBlock = -1;
    this.isRunning = false;

    // Concurrency lock, timers, and exponential backoff variables to prevent OOM / loops
    this.isProcessing = false;
    this.scheduleTimeout = null;
    this.retryDelay = 5000; // start with 5s delay
    this.maxRetryDelay = 5 * 60 * 1000; // max 5 minutes
  }

  async start() {
    this.loadCheckpoint();
    this.isRunning = true;
    console.log(`[ArchiveWriter] Started continuous archiver. Last archived block: ${this.lastArchivedBlock}`);
    
    // Check if we can archive any existing blocks immediately after boot
    this.schedulePendingChunk(1000);
  }

  loadCheckpoint() {
    if (fs.existsSync(this.checkpointPath)) {
      try {
        const checkpoint = JSON.parse(fs.readFileSync(this.checkpointPath, 'utf8'));
        this.lastArchivedBlock = checkpoint.lastArchivedBlock ?? -1;
      } catch (err) {
        console.error('[ArchiveWriter] Failed to read checkpoint for continuous writer:', err.message);
      }
    }
  }

  saveCheckpoint() {
    try {
      let checkpoint = {};
      if (fs.existsSync(this.checkpointPath)) {
        checkpoint = JSON.parse(fs.readFileSync(this.checkpointPath, 'utf8'));
      }
      checkpoint.lastArchivedBlock = this.lastArchivedBlock;
      fs.writeFileSync(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
    } catch (err) {
      console.error('[ArchiveWriter] Failed to write checkpoint:', err.message);
    }
  }

  queueBlock(block) {
    if (!this.isRunning) return;
    if (this.blockchain.isSyncing) return; // skip continuous write during active sync
    this.schedulePendingChunk(100);
  }

  schedulePendingChunk(delay = 0) {
    if (!this.isRunning) return;
    if (this.isProcessing) return;
    if (this.blockchain.isSyncing) return; // skip scheduling during active sync

    if (this.scheduleTimeout) {
      clearTimeout(this.scheduleTimeout);
    }

    this.scheduleTimeout = setTimeout(() => {
      this.scheduleTimeout = null;
      this.writePendingChunk().catch(err => {
        console.error('[ArchiveWriter] Continuous archiving error:', err.message);
      });
    }, delay);
  }

  async writePendingChunk() {
    if (this.isProcessing || !this.isRunning) return;
    if (this.blockchain.isSyncing) return; // skip writing during active sync

    this.isProcessing = true;

    const start = this.lastArchivedBlock + 1;
    const end = start + this.batchSize - 1;

    // We only create a chunk if we have at least batchSize blocks available
    const blocks = [];
    for (let i = start; i <= end; i++) {
      try {
        const rawBlock = await this.blockchain.db.get(`block:${i}`);
        if (!rawBlock) {
          this.isProcessing = false;
          return; // incomplete batch
        }
        blocks.push(typeof rawBlock === 'string' ? JSON.parse(rawBlock) : rawBlock);
      } catch (err) {
        // block not found or db error - means the batch is not ready
        this.isProcessing = false;
        return;
      }
    }

    console.log(`[ArchiveWriter] Creating and writing chunk for blocks ${start}-${end}...`);
    try {
      // Check repository size and rotate if needed
      await this.repoManager.checkAndRotate(start);

      // Verify the chunk cryptographically
      const { buildChunkMerkleTree, verifyChunk } = await import('./merkleVerify.js');
      const tree = buildChunkMerkleTree(blocks);
      const merkleRoot = tree.getRoot();

      const chunk = {
        startHeight: start,
        endHeight: end,
        merkleRoot,
        blocks
      };

      const isValid = await verifyChunk(chunk);
      if (!isValid) {
        console.error(`[ArchiveWriter] Chunk ${start}-${end} failed verification. Writing aborted.`);
        this.isProcessing = false;
        
        // Apply backoff
        this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetryDelay);
        console.log(`[ArchiveWriter] Backing off verification retry for ${this.retryDelay / 1000}s`);
        this.schedulePendingChunk(this.retryDelay);
        return;
      }

      // Write chunk to GitHub
      const currentRepo = this.repoManager.currentRepo;
      await this.githubClient.queueWrite(`chunks/chunk_${start}_${end}.json`, chunk, currentRepo);

      // Write a state snapshot at this chunk boundary for history tracking
      const stateSnapshot = this.blockchain.state.exportState();
      await this.githubClient.queueWrite(`snapshots/state_${end}.json`, stateSnapshot, currentRepo);

      // Update checkpoint
      this.lastArchivedBlock = end;
      this.saveCheckpoint();
      console.log(`[ArchiveWriter] Successfully archived chunk ${start}-${end}`);

      // Reset backoff on success
      this.retryDelay = 5000;
      this.isProcessing = false;

      // Check if another chunk is already ready to be processed immediately
      this.schedulePendingChunk(0);
    } catch (err) {
      console.error(`[ArchiveWriter] Error writing chunk ${start}-${end}:`, err.message);
      this.isProcessing = false;

      // Apply backoff
      this.retryDelay = Math.min(this.retryDelay * 2, this.maxRetryDelay);
      console.log(`[ArchiveWriter] Backing off write retry for ${this.retryDelay / 1000}s`);
      this.schedulePendingChunk(this.retryDelay);
    }
  }

  async flushQueue() {
    try {
      await this.githubClient.flush();
    } catch (err) {
      console.error('[ArchiveWriter] Error flushing queue:', err.message);
    }
  }
}
