import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class RepoManager {
  constructor(githubClient, config) {
    this.githubClient = githubClient;
    this.config = config;
    this.baseRepo = config.githubRepo || 'sayman-archive';
    this.softLimit = 4.5 * 1024 * 1024 * 1024; // 4.5 GB in bytes
    this.registryPath = path.resolve(config.registryPath || './data/archive-registry.json');
    this.registry = { mappings: [], hash: '' };
    this.currentRepo = this.baseRepo;
  }

  async initialize() {
    // 1. Try GitHub (base repo) first to get the latest mappings from the network
    try {
      const gitData = await this.githubClient.readFile('registry/index.json', this.baseRepo, true); // bypassCDN
      if (this.verifyRegistry(gitData)) {
        this.registry = gitData;
        this.currentRepo = this.getCurrentRepoFromRegistry();
        this.saveLocalRegistry();
        console.log(`[RepoManager] Registry loaded from GitHub. Current Repo: ${this.currentRepo}`);
        return;
      }
    } catch (err) {
      console.log('[RepoManager] Registry file not found or failed to load from GitHub. Trying local...');
    }

    // 2. Try local disk
    if (fs.existsSync(this.registryPath)) {
      try {
        const localData = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
        if (this.verifyRegistry(localData)) {
          this.registry = localData;
          this.currentRepo = this.getCurrentRepoFromRegistry();
          console.log(`[RepoManager] Registry loaded from local file. Current Repo: ${this.currentRepo}`);
          return;
        }
        console.warn('[RepoManager] Local registry hash verification failed.');
      } catch (err) {
        console.warn('[RepoManager] Failed to read local registry:', err.message);
      }
    }

    // 3. Fallback: Initialize new registry
    this.registry = {
      mappings: [
        {
          startHeight: 0,
          endHeight: null,
          repo: this.baseRepo
        }
      ],
      hash: ''
    };
    this.registry.hash = this.calculateRegistryHash(this.registry.mappings);
    this.currentRepo = this.baseRepo;
    this.saveLocalRegistry();
    console.log(`[RepoManager] Initialized new registry with base repository: ${this.currentRepo}`);
  }

  calculateRegistryHash(mappings) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(mappings))
      .digest('hex');
  }

  verifyRegistry(registry) {
    if (!registry || !registry.mappings || !registry.hash) return false;
    const computed = this.calculateRegistryHash(registry.mappings);
    return computed === registry.hash;
  }

  getCurrentRepoFromRegistry() {
    const active = this.registry.mappings.find(m => m.endHeight === null);
    return active ? active.repo : this.baseRepo;
  }

  getRepoForHeight(height) {
    for (const mapping of this.registry.mappings) {
      if (height >= mapping.startHeight && (mapping.endHeight === null || height <= mapping.endHeight)) {
        return mapping.repo;
      }
    }
    return this.currentRepo;
  }

  async checkAndRotate(blockHeight) {
    if (!this.githubClient.token) return; // Read-only

    try {
      const size = await this.githubClient.getRepoSize(this.currentRepo);
      console.log(`[RepoManager] Repository ${this.currentRepo} size: ${(size / (1024 * 1024)).toFixed(2)} MB`);
      
      if (size >= this.softLimit) {
        console.log(`[RepoManager] Repo ${this.currentRepo} size exceeds soft limit (4.5GB). Rotating...`);

        // Close current mapping
        const activeMapping = this.registry.mappings.find(m => m.repo === this.currentRepo && m.endHeight === null);
        if (activeMapping) {
          activeMapping.endHeight = blockHeight - 1;
        }

        // Determine next repo name
        let index = 1;
        const match = this.currentRepo.match(/-(\d+)$/);
        if (match) {
          index = parseInt(match[1], 10) + 1;
        }
        const nextRepo = `${this.baseRepo}-${index}`;

        // Create new repository
        await this.githubClient.createRepository(nextRepo);

        // Add new mapping
        this.registry.mappings.push({
          startHeight: blockHeight,
          endHeight: null,
          repo: nextRepo
        });

        this.currentRepo = nextRepo;
        this.registry.hash = this.calculateRegistryHash(this.registry.mappings);

        await this.saveRegistry();
        console.log(`[RepoManager] Rotated to repository: ${this.currentRepo}`);
      }
    } catch (err) {
      console.error('[RepoManager] Rotation check failed:', err.message);
    }
  }

  saveLocalRegistry() {
    try {
      const dir = path.dirname(this.registryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 2));
    } catch (err) {
      console.error('[RepoManager] Failed to write local registry file:', err.message);
    }
  }

  async saveRegistry() {
    this.registry.hash = this.calculateRegistryHash(this.registry.mappings);
    this.saveLocalRegistry();

    if (this.githubClient.token) {
      try {
        // Write registry/index.json to current repo
        await this.githubClient.queueWrite('registry/index.json', this.registry, this.currentRepo);
        // Also write it back to baseRepo to keep central registry updated
        if (this.currentRepo !== this.baseRepo) {
          await this.githubClient.queueWrite('registry/index.json', this.registry, this.baseRepo);
        }
        console.log('[RepoManager] Registry queued for remote update.');
      } catch (err) {
        console.error('[RepoManager] Failed to queue remote registry write:', err.message);
      }
    }
  }

  async verifyAllReposAccessible() {
    for (const mapping of this.registry.mappings) {
      const ok = await this.githubClient.checkRepository(mapping.repo);
      if (!ok) {
        console.warn(`⚠️ Repository ${mapping.repo} is not accessible or does not exist!`);
        return false;
      }
    }
    return true;
  }
}
