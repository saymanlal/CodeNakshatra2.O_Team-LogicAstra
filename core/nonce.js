/**
 * NonceManager — Phase 22 (fast, non-blocking)
 *
 * Node.js is single-threaded. There is NO concurrent memory race between two
 * synchronous JS operations. The "nonce conflict" bug is always caused by:
 *   1. Client caching a stale nonce across multiple button clicks, OR
 *   2. Two mempool tx reads happening in separate event-loop ticks before
 *      the first write commits (rare, fixed by pendingNonces map below).
 *
 * This manager uses ZERO async/await and ZERO spinlocks. Every operation is
 * a single synchronous step that cannot be interrupted — so there is no race
 * window and no added latency.
 *
 * Server-side guarantee:
 *   getNextNonce() reads confirmed + pending in one synchronous call, increments,
 *   and returns — the entire operation takes < 1 µs and never blocks anything.
 *
 * Client-side guarantee (enforced in wallet/SAYFORGE):
 *   Always fetch /api/address/:addr just before broadcast — never reuse a cached nonce.
 */

class NonceManager {
  constructor() {
    // address → highest nonce assigned to a pending (unconfirmed) tx
    this.pendingNonces = new Map();
  }

  // ── Primary API: called once per broadcast, synchronously ─────────────────
  // getConfirmedNonce is a SYNCHRONOUS function: address => number
  // (pass blockchain.state.getNonce — it reads from an in-memory Map, no I/O)
  getNextNonce(address, getConfirmedNonce) {
    const confirmed = typeof getConfirmedNonce === 'function'
      ? getConfirmedNonce(address)
      : 0;

    // If we have a pending nonce for this address that's ahead of confirmed, use that + 1.
    // Otherwise use confirmed (which is the next expected nonce from chain state).
    const lastPending = this.pendingNonces.has(address)
      ? this.pendingNonces.get(address)
      : confirmed - 1;

    const next = Math.max(confirmed, lastPending + 1);
    this.pendingNonces.set(address, next);
    return next;
  }

  // ── Rollback: call on any broadcast failure so the slot isn't burned ───────
  releaseOnFailure(address, nonce) {
    const current = this.pendingNonces.get(address);
    if (current === nonce) {
      if (nonce <= 0) {
        this.pendingNonces.delete(address);
      } else {
        this.pendingNonces.set(address, nonce - 1);
      }
    }
  }

  // ── Called when block is confirmed: sync pending map to on-chain state ─────
  confirmMined(address, confirmedNonce) {
    const current = this.pendingNonces.get(address) ?? 0;
    if (current < confirmedNonce) {
      this.pendingNonces.set(address, confirmedNonce);
    }
  }

  // ── Simple read (for display / validation) ────────────────────────────────
  getNonce(address) {
    return this.pendingNonces.get(address) ?? 0;
  }

  setNonce(address, nonce) {
    this.pendingNonces.set(address, nonce);
  }

  // ── Legacy helpers (preserved for any old callers) ────────────────────────
  incrementNonce(address) {
    const current = this.pendingNonces.get(address) ?? 0;
    this.pendingNonces.set(address, current + 1);
    return current + 1;
  }

  validateNonce(address, nonce) {
    const expected = this.getNonce(address);
    if (nonce !== expected) {
      throw new Error(`Invalid nonce. Expected: ${expected}, Got: ${nonce}`);
    }
    return true;
  }

  reset() {
    this.pendingNonces.clear();
  }

  toJSON() {
    return Array.from(this.pendingNonces.entries());
  }

  fromJSON(data) {
    this.pendingNonces = new Map(data || []);
  }
}

export default NonceManager;