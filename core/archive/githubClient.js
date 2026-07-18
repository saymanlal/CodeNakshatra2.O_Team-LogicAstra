import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';
import { retry } from '@octokit/plugin-retry';
import fetch from 'node-fetch';

const ThrottledOctokit = Octokit.plugin(throttling, retry);

class TokenBucket {
  constructor(maxTokens = 10, refillRate = 2) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate; // tokens per second
    this.lastRefill = Date.now();
  }

  async consume() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const delay = ((1 - this.tokens) / this.refillRate) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.consume();
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + (elapsed * this.refillRate));
    this.lastRefill = now;
  }
}

export class GithubClient {
  constructor(config) {
    this.config = config;
    this.owner = config.githubOwner || 'saymanlal';
    this.repo = config.githubRepo || 'sayman-archive';
    this.branch = config.githubBranch || 'main';
    this.token = config.githubToken;
    this.useCDN = config.useCDN !== false;

    this.remainingCalls = 5000;
    this.rateLimitBuffer = 50; // Keep at least 50 calls free

    this.bucket = new TokenBucket(30, 5); // 30 max burst, 5 requests per second
    this.buffer = [];
    this.lastCommitTime = 0;
    this.commitTimeout = null;
    this.isFlushing = false;

    if (!this.token) {
      console.warn('⚠️ GitHub token is missing in config! Archive client running in read-only mode.');
    }

    this.octokit = new ThrottledOctokit({
      auth: this.token,
      throttle: {
        onRateLimit: (retryAfter, options, octokit, retryCount) => {
          console.warn(`[GitHub API] Rate limit hit for ${options.method} ${options.url}. Retrying after ${retryAfter}s...`);
          if (retryCount < 3) return true;
        },
        onSecondaryRateLimit: (retryAfter, options, octokit) => {
          console.warn(`[GitHub API] Secondary rate limit hit for ${options.method} ${options.url}. Retrying after ${retryAfter}s...`);
          return true;
        },
      },
      retry: {
        doNotRetry: ['400', '401', '403', '404', '422'],
      }
    });

    // Intercept headers to monitor rate limits
    this.octokit.hook.after('request', (response) => {
      const remaining = response.headers['x-ratelimit-remaining'];
      if (remaining !== undefined) {
        this.remainingCalls = parseInt(remaining, 10);
      }
    });
  }

  async _preRequestCheck() {
    if (this.remainingCalls <= this.rateLimitBuffer) {
      throw new Error(`[GitHub Client] API calls exhausted. Remaining: ${this.remainingCalls}, Limit Buffer: ${this.rateLimitBuffer}`);
    }
    await this.bucket.consume();
  }

  async checkRepository(repoName = this.repo) {
    try {
      await this._preRequestCheck();
      const res = await this.octokit.repos.get({
        owner: this.owner,
        repo: repoName
      });
      return res.status === 200;
    } catch (err) {
      console.error(`[GitHub Client] Repository check failed for ${repoName}:`, err.message);
      return false;
    }
  }

  async createRepository(repoName) {
    try {
      await this._preRequestCheck();
      console.log(`[GitHub Client] Creating new repository: ${this.owner}/${repoName}...`);
      await this.octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: false,
        auto_init: true,
        description: `Sayman Blockchain Archive Repository for ${repoName}`
      });
      console.log(`[GitHub Client] Repository ${repoName} created successfully.`);
      return true;
    } catch (err) {
      console.error(`[GitHub Client] Failed to create repository ${repoName}:`, err.message);
      throw err;
    }
  }

  async getRepoSize(repoName = this.repo) {
    try {
      await this._preRequestCheck();
      const res = await this.octokit.repos.get({
        owner: this.owner,
        repo: repoName
      });
      // size is in KB
      return (res.data.size || 0) * 1024; // in bytes
    } catch (err) {
      console.error(`[GitHub Client] Error fetching size for repo ${repoName}:`, err.message);
      throw err;
    }
  }

  async readFile(path, repoName = this.repo, bypassCDN = false) {
    if (bypassCDN) {
      try {
        await this._preRequestCheck();
        const res = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: repoName,
          path,
          ref: this.branch
        });

        if (res.data && res.data.content) {
          const content = Buffer.from(res.data.content, 'base64').toString('utf8');
          try {
            return JSON.parse(content);
          } catch {
            return content;
          }
        }
        throw new Error(`No content found at ${path}`);
      } catch (err) {
        console.warn(`[GitHub Client] Real-time read failed for ${path}: ${err.message}. Falling back to CDN...`);
      }
    }

    if (this.useCDN) {
      const cdnUrl = `https://cdn.jsdelivr.net/gh/${this.owner}/${repoName}@${this.branch}/${path}`;
      try {
        const res = await fetch(cdnUrl);
        if (res.ok) {
          const text = await res.text();
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        }
        console.warn(`[GitHub Client] CDN read failed for ${path} (${res.status}). Falling back to raw GitHub API...`);
      } catch (err) {
        console.warn(`[GitHub Client] CDN read error for ${path}: ${err.message}. Falling back to raw GitHub API...`);
      }
    }

    // Fallback: GitHub API
    try {
      await this._preRequestCheck();
      const res = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: repoName,
        path,
        ref: this.branch
      });

      if (res.data && res.data.content) {
        const content = Buffer.from(res.data.content, 'base64').toString('utf8');
        try {
          return JSON.parse(content);
        } catch {
          return content;
        }
      }
      throw new Error(`No content found at ${path}`);
    } catch (err) {
      throw new Error(`Failed to read file from GitHub: ${err.message}`);
    }
  }

  async queueWrite(path, content, repoName = this.repo) {
    if (!this.token) {
      throw new Error('[GitHub Client] Cannot write. GitHub token is not configured.');
    }
    
    // Add to buffer
    this.buffer.push({ path, content, repoName });

    if (this.buffer.length >= 10) {
      await this.flush();
    } else {
      this.scheduleFlush(5000);
    }
  }

  scheduleFlush(delay = 5000) {
    if (this.commitTimeout) return;
    this.commitTimeout = setTimeout(async () => {
      this.commitTimeout = null;
      try {
        await this.flush();
      } catch (err) {
        console.error('[GitHub Client] Buffered flush error:', err.message);
      }
    }, delay);
  }

  async flush() {
    if (this.isFlushing || this.buffer.length === 0) return;
    this.isFlushing = true;

    const now = Date.now();
    const timeSinceLastCommit = now - this.lastCommitTime;
    if (timeSinceLastCommit < 5000) {
      const waitTime = 5000 - timeSinceLastCommit;
      this.isFlushing = false;
      this.scheduleFlush(waitTime);
      return;
    }

    // Get the batch of files (max 10, group by repoName to push as one commit per repo)
    const currentRepo = this.buffer[0].repoName;
    const batch = [];
    const remaining = [];

    for (const item of this.buffer) {
      if (item.repoName === currentRepo && batch.length < 10) {
        batch.push(item);
      } else {
        remaining.push(item);
      }
    }

    this.buffer = remaining;
    this.lastCommitTime = Date.now();

    try {
      await this._commitBatch(currentRepo, batch);
    } catch (err) {
      console.error(`[GitHub Client] Failed to commit batch to ${currentRepo}:`, err.message);
      // Put files back to the front of the queue to retry
      this.buffer = [...batch, ...this.buffer];
      this.isFlushing = false;
      throw err;
    }

    this.isFlushing = false;
    // If more items remain in the buffer, schedule another flush
    if (this.buffer.length > 0) {
      this.scheduleFlush(5000);
    }
  }

  async _commitBatch(repoName, batch, retryCount = 0) {
    console.log(`[GitHub Client] Committing ${batch.length} files to ${this.owner}/${repoName} branch ${this.branch}...`);
    try {
      await this._preRequestCheck();

      // 1. Get Ref to find latest commit SHA
      let latestCommitSha;
      let baseTreeSha;
      try {
        const refRes = await this.octokit.git.getRef({
          owner: this.owner,
          repo: repoName,
          ref: `heads/${this.branch}`
        });
        latestCommitSha = refRes.data.object.sha;

        // 2. Get Commit to find Tree SHA
        const commitRes = await this.octokit.git.getCommit({
          owner: this.owner,
          repo: repoName,
          commit_sha: latestCommitSha
        });
        baseTreeSha = commitRes.data.tree.sha;
      } catch (refErr) {
        const isEmpty = refErr.message.includes('Git Repository is empty') || 
                        refErr.status === 409 || 
                        refErr.status === 404 ||
                        (refErr.message && refErr.message.toLowerCase().includes('empty'));
        if (isEmpty) {
          console.log(`[GitHub Client] Repository ${repoName} is empty. Initializing branch ${this.branch}...`);
          // Create the first file directly to initialize the repository and branch
          const firstFile = batch[0];
          const createRes = await this.octokit.repos.createOrUpdateFileContents({
            owner: this.owner,
            repo: repoName,
            path: firstFile.path,
            message: 'Initialize repository with first archive file',
            content: Buffer.from(typeof firstFile.content === 'object' ? JSON.stringify(firstFile.content, null, 2) : firstFile.content).toString('base64'),
            branch: this.branch
          });
          console.log(`[GitHub Client] Repository initialized successfully. Commit SHA: ${createRes.data.commit.sha}`);
          
          // If there are more files in the batch, commit the rest using standard method
          if (batch.length > 1) {
            const rest = batch.slice(1);
            return this._commitBatch(repoName, rest);
          }
          return;
        } else {
          throw refErr;
        }
      }

      // 3. Create Tree
      const tree = batch.map(file => ({
        path: file.path,
        mode: '100644',
        type: 'blob',
        content: typeof file.content === 'object' ? JSON.stringify(file.content, null, 2) : file.content
      }));

      const treeRes = await this.octokit.git.createTree({
        owner: this.owner,
        repo: repoName,
        tree,
        base_tree: baseTreeSha
      });
      const newTreeSha = treeRes.data.sha;

      // 4. Create Commit
      const commitMsg = `Archive commit: ${batch.length} files`;
      const newCommitRes = await this.octokit.git.createCommit({
        owner: this.owner,
        repo: repoName,
        message: commitMsg,
        tree: newTreeSha,
        parents: [latestCommitSha]
      });
      const newCommitSha = newCommitRes.data.sha;

      // 5. Update Ref
      await this.octokit.git.updateRef({
        owner: this.owner,
        repo: repoName,
        ref: `heads/${this.branch}`,
        sha: newCommitSha
      });

      console.log(`[GitHub Client] Successfully committed batch to ${repoName}. Commit SHA: ${newCommitSha}`);
    } catch (err) {
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.warn(`[GitHub Client] Commit failed: ${err.message}. Retrying in ${delay}ms... (Attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._commitBatch(repoName, batch, retryCount + 1);
      }
      throw err;
    }
  }
}
