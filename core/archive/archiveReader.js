import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { verifyChunk } from './merkleVerify.js';

export class ArchiveReader {
  constructor(githubClient, repoManager, config) {
    this.githubClient = githubClient;
    this.repoManager = repoManager;
    this.config = config;
    this.owner = config.githubOwner || 'saymanlal';
    this.branch = config.githubBranch || 'main';
    this.useCDN = config.useCDN !== false;
    this.ipfsGateway = config.ipfsGateway || null;

    this.cacheDir = path.resolve(config.archiveCacheDir || './data/archive-cache');
    this.memoryCache = new Map(); // chunkKey -> chunkData
    this.maxMemoryCacheSize = 50; // Cache up to 50 chunks in memory

    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async readChunk(startHeight, endHeight) {
    const chunkKey = `chunk_${startHeight}_${endHeight}`;

    // 1. Memory Cache
    if (this.memoryCache.has(chunkKey)) {
      return this.memoryCache.get(chunkKey);
    }

    // 2. Disk Cache
    const diskPath = path.join(this.cacheDir, `${chunkKey}.json`);
    if (fs.existsSync(diskPath)) {
      try {
        const chunk = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
        // Verify disk cached chunk to prevent tampering
        const isValid = await verifyChunk(chunk);
        if (isValid) {
          this._addToMemoryCache(chunkKey, chunk);
          return chunk;
        }
        console.warn(`[ArchiveReader] Disk cache chunk ${chunkKey} failed verification. Re-downloading...`);
      } catch (err) {
        console.warn(`[ArchiveReader] Failed to parse disk cache chunk ${chunkKey}:`, err.message);
      }
    }

    // 3. Resolve Repo Name
    const repoName = this.repoManager.getRepoForHeight(startHeight);
    const chunkPath = `chunks/chunk_${startHeight}_${endHeight}.json`;

    // 4. Download with Fallbacks
    let chunk = null;
    let errors = [];

    // Fallback 1: CDN
    if (this.useCDN) {
      try {
        const cdnUrl = `https://cdn.jsdelivr.net/gh/${this.owner}/${repoName}@${this.branch}/${chunkPath}`;
        const res = await fetch(cdnUrl);
        if (res.ok) {
          chunk = await res.json();
          console.log(`[ArchiveReader] Retrieved chunk ${chunkKey} from CDN.`);
        } else {
          errors.push(`CDN returned status ${res.status}`);
        }
      } catch (err) {
        errors.push(`CDN error: ${err.message}`);
      }
    }

    // Fallback 2: Raw GitHub API
    if (!chunk) {
      try {
        chunk = await this.githubClient.readFile(chunkPath, repoName);
        console.log(`[ArchiveReader] Retrieved chunk ${chunkKey} from GitHub API.`);
      } catch (err) {
        errors.push(`GitHub API error: ${err.message}`);
      }
    }

    // Fallback 3: IPFS Gateway (if configured)
    if (!chunk && this.ipfsGateway) {
      try {
        const ipfsUrl = `${this.ipfsGateway}/github/${this.owner}/${repoName}/${this.branch}/${chunkPath}`;
        const res = await fetch(ipfsUrl);
        if (res.ok) {
          chunk = await res.json();
          console.log(`[ArchiveReader] Retrieved chunk ${chunkKey} from IPFS.`);
        } else {
          errors.push(`IPFS returned status ${res.status}`);
        }
      } catch (err) {
        errors.push(`IPFS error: ${err.message}`);
      }
    }

    if (!chunk) {
      throw new Error(`[ArchiveReader] Failed to retrieve chunk ${chunkKey}. Fallback logs:\n- ${errors.join('\n- ')}`);
    }

    // 5. Verify the chunk cryptographically
    const isValid = await verifyChunk(chunk);
    if (!isValid) {
      throw new Error(`[ArchiveReader] Retrieved chunk ${chunkKey} failed cryptographic verification.`);
    }

    // 6. Cache the chunk
    this._saveToDiskCache(diskPath, chunk);
    this._addToMemoryCache(chunkKey, chunk);

    return chunk;
  }

  async readBlock(height) {
    // Determine the chunk that contains this block height
    const batchSize = this.config.archive.batchSize || 1000;
    const chunkIndex = Math.floor(height / batchSize);
    const startHeight = chunkIndex * batchSize;
    const endHeight = startHeight + batchSize - 1;

    try {
      const chunk = await this.readChunk(startHeight, endHeight);
      const block = chunk.blocks.find(b => b.index === height);
      if (!block) {
        throw new Error(`Block #${height} not found in chunk ${startHeight}-${endHeight}`);
      }
      return block;
    } catch (err) {
      console.error(`[ArchiveReader] Error reading block #${height}:`, err.message);
      throw err;
    }
  }

  async readStateSnapshot(height) {
    const repoName = this.repoManager.getRepoForHeight(height);
    const snapshotPath = `snapshots/state_${height}.json`;

    // Try CDN
    if (this.useCDN) {
      try {
        const cdnUrl = `https://cdn.jsdelivr.net/gh/${this.owner}/${repoName}@${this.branch}/${snapshotPath}`;
        const res = await fetch(cdnUrl);
        if (res.ok) {
          return await res.json();
        }
      } catch {}
    }

    // Try GitHub API
    return await this.githubClient.readFile(snapshotPath, repoName);
  }

  _addToMemoryCache(key, data) {
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, data);
  }

  _saveToDiskCache(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data));
    } catch (err) {
      console.warn('[ArchiveReader] Failed to write disk cache file:', err.message);
    }
  }

  async *streamBlocks(start, end) {
    let current = start;
    const batchSize = this.config.archive.batchSize || 1000;
    
    while (current <= end) {
      const chunkIndex = Math.floor(current / batchSize);
      const chunkStart = chunkIndex * batchSize;
      const chunkEnd = chunkStart + batchSize - 1;
      
      const chunk = await this.readChunk(chunkStart, chunkEnd);
      const filteredBlocks = chunk.blocks.filter(b => b.index >= current && b.index <= end);
      
      for (const block of filteredBlocks) {
        yield block;
      }
      
      current = chunkEnd + 1;
    }
  }
}
