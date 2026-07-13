import fs from 'fs';
import path from 'path';
import { verifyChunk } from './merkleVerify.js';

export async function runMigration(blockchain, archiveWriter) {
  const config = blockchain.config;
  const checkpointPath = path.resolve(config.archive.migrationCheckpoint || './data/migration-checkpoint.json');
  console.log(`[Migration] Starting migration. Checkpoint file: ${checkpointPath}`);

  // Ensure checkpoint directory exists
  const checkpointDir = path.dirname(checkpointPath);
  if (!fs.existsSync(checkpointDir)) {
    fs.mkdirSync(checkpointDir, { recursive: true });
  }

  let checkpoint = {
    lastArchivedBlock: -1,
    stateMigrated: false,
    migrationComplete: false
  };

  if (fs.existsSync(checkpointPath)) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
      console.log(`[Migration] Resuming from checkpoint. Last archived block: ${checkpoint.lastArchivedBlock}`);
    } catch (err) {
      console.error('[Migration] Failed to parse checkpoint file. Restarting migration from block 0.', err.message);
    }
  }

  if (checkpoint.migrationComplete) {
    console.log('[Migration] Migration already complete according to checkpoint.');
    return;
  }

  const db = blockchain.db;
  let latestHeight = 0;
  try {
    const rawHeight = await db.get('latest_height');
    latestHeight = parseInt(rawHeight, 10);
  } catch (err) {
    console.log('[Migration] No latest_height found in LevelDB. Is this a fresh chain? Migration marked complete.');
    checkpoint.migrationComplete = true;
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    return;
  }

  console.log(`[Migration] Current latest height in LevelDB: ${latestHeight}`);
  const batchSize = config.archive.batchSize || 1000;
  let start = checkpoint.lastArchivedBlock + 1;

  while (start <= latestHeight) {
    const end = Math.min(start + batchSize - 1, latestHeight);
    // Only package complete batches, or if we have reached the end of the chain, we package the remaining blocks.
    console.log(`[Migration] Reading blocks ${start} to ${end} from LevelDB...`);
    const blocksBatch = [];

    for (let i = start; i <= end; i++) {
      try {
        const blockData = await db.get(`block:${i}`);
        // If it's stored as string or object, parse appropriately
        const blockJson = typeof blockData === 'string' ? JSON.parse(blockData) : blockData;
        blocksBatch.push(blockJson);
      } catch (err) {
        console.error(`[Migration] Failed to read block #${i} from LevelDB:`, err.message);
        throw err;
      }
    }

    if (blocksBatch.length > 0) {
      // 1. Verify rotation limit
      await archiveWriter.repoManager.checkAndRotate(start);

      // 2. Build Merkle tree and Chunk
      const { buildChunkMerkleTree } = await import('./merkleVerify.js');
      const tree = buildChunkMerkleTree(blocksBatch);
      const merkleRoot = tree.getRoot();

      const chunk = {
        startHeight: start,
        endHeight: end,
        merkleRoot,
        blocks: blocksBatch
      };

      // 3. Verify locally
      const isChunkValid = await verifyChunk(chunk);
      if (!isChunkValid) {
        throw new Error(`[Migration] Cryptographic verification failed for chunk ${start}-${end}`);
      }

      // 4. Write to current repo
      const currentRepo = archiveWriter.repoManager.currentRepo;
      const chunkPath = `chunks/chunk_${start}_${end}.json`;
      console.log(`[Migration] Queueing chunk ${chunkPath} to ${currentRepo}...`);
      await archiveWriter.githubClient.queueWrite(chunkPath, chunk, currentRepo);

      // 5. Update checkpoint
      checkpoint.lastArchivedBlock = end;
      fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
      console.log(`Migrating block ${end}/${latestHeight}`);
    }

    start = end + 1;
    // Yield to the event loop to ensure zero disruption to the chain
    await new Promise(resolve => setImmediate(resolve));
  }

  // Migrate overall states if not done
  if (!checkpoint.stateMigrated) {
    console.log('[Migration] Migrating smart contracts, staking positions, and balances snapshot...');
    const stateSnapshot = blockchain.state.exportState();
    const currentRepo = archiveWriter.repoManager.currentRepo;

    await archiveWriter.githubClient.queueWrite(
      `snapshots/state_${latestHeight}.json`,
      stateSnapshot,
      currentRepo
    );

    await archiveWriter.githubClient.queueWrite(
      'snapshots/latest.json',
      { height: latestHeight, repo: currentRepo },
      currentRepo
    );

    checkpoint.stateMigrated = true;
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }

  // Flush the queue to make sure everything is committed
  console.log('[Migration] Flushing final batch of writes to GitHub...');
  await archiveWriter.githubClient.flush();

  checkpoint.migrationComplete = true;
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
  console.log('[Migration] Migration COMPLETED successfully.');
}
