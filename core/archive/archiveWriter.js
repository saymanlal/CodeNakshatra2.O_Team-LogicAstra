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
  }

  async start() {
    this.loadCheckpoint();
    this.isRunning = true;
    console.log(`[ArchiveWriter] Started continuous archiver. Last archived block: ${this.lastArchivedBlock}`);
    
    // Check if we can archive any existing blocks immediately
    setImmediate(() => {
      this.writePendingChunk().catch(err => {
        console.error('[ArchiveWriter] Initial chunk archiving failed:', err.message);
      });
    });
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
    setImmediate(() => {
      this.writePendingChunk().catch(err => {
        console.error('[ArchiveWriter] Continuous archiving error:', err.message);
      });
    });
  }

  async writePendingChunk() {
    const start = this.lastArchivedBlock + 1;
    const end = start + this.batchSize - 1;

    // We only create a chunk if we have at least batchSize blocks available
    const blocks = [];
    for (let i = start; i <= end; i++) {
      try {
        const rawBlock = await this.blockchain.db.get(`block:${i}`);
        if (!rawBlock) return; // incomplete batch
        blocks.push(typeof rawBlock === 'string' ? JSON.parse(rawBlock) : rawBlock);
      } catch (err) {
        // block not found or db error - means the batch is not ready
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

      // Check if another chunk is already ready to be processed
      await this.writePendingChunk();
    } catch (err) {
      console.error(`[ArchiveWriter] Error writing chunk ${start}-${end}:`, err.message);
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
