/**
 * OIDC login-transaction state store (PKCE code_verifier + state token).
 *
 * Background: the original implementation kept this state in a per-process
 * `Map`, which breaks when multiple app replicas sit behind round-robin
 * routing (the /auth/callback can land on a different pod than the one that
 * started login → silent redirect loop). See investigation report:
 * .local/login-redirect-loop-investigation-2026-06-10.md §8.
 *
 * This module moves the state to the shared Redis/Valkey store so any
 * replica can serve the callback. When Redis is not configured (local dev /
 * single-replica), it falls back to an in-memory Map with the same TTL
 * semantics.
 *
 * Keys are global (no space namespace) because login has no space context.
 */

import { REDIS_URL, OIDC_STATE_KEY_PREFIX } from '../config.js';
import { keyValueStore } from './key-value-store-factory.js';
import { logger } from '../utils/structured-logger.js';

/** TTL for OIDC state entries (10 minutes), in seconds for Redis SETEX. */
const STATE_TTL_SECONDS = 600;

/** Shape stored per OIDC login transaction. */
export interface OidcStateEntry {
  codeVerifier: string;
  createdAt: number;
}

/** Redis key for a given state token. */
function stateKey(state: string): string {
  return `${OIDC_STATE_KEY_PREFIX}${state}`;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface OidcStateStore {
  /** Persist PKCE state for a new login transaction. */
  set(state: string, entry: OidcStateEntry): Promise<void>;
  /**
   * Atomically consume (read-then-delete) a state entry.
   * Returns the entry on first call, undefined on subsequent calls or after TTL.
   */
  consume(state: string): Promise<OidcStateEntry | undefined>;
  /** Backend label for startup logging. */
  readonly backend: 'redis' | 'memory';
}

// ---------------------------------------------------------------------------
// Redis-backed implementation
// ---------------------------------------------------------------------------

class RedisOidcStateStore implements OidcStateStore {
  readonly backend = 'redis' as const;

  async set(state: string, entry: OidcStateEntry): Promise<void> {
    await keyValueStore.setJson(stateKey(state), entry, STATE_TTL_SECONDS);
  }

  async consume(state: string): Promise<OidcStateEntry | undefined> {
    // Atomic GETDEL: single Redis command, no race window.
    const entry = await keyValueStore.getdelJson<OidcStateEntry>(stateKey(state));
    return entry ?? undefined;
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback (single-replica / local dev without Redis)
// ---------------------------------------------------------------------------

interface MemEntry {
  entry: OidcStateEntry;
  expiresAt: number;
}

export class MemoryOidcStateStore implements OidcStateStore {
  readonly backend = 'memory' as const;
  private readonly store = new Map<string, MemEntry>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic sweep to evict expired entries (same as the original pruneOidcStateStore).
    this.sweepTimer = setInterval(() => this.sweep(), 60_000);
    // Allow Node to exit even if the timer is still running.
    if (typeof this.sweepTimer === 'object' && 'unref' in this.sweepTimer) {
      this.sweepTimer.unref();
    }
  }

  async set(state: string, entry: OidcStateEntry): Promise<void> {
    this.store.set(state, { entry, expiresAt: Date.now() + STATE_TTL_SECONDS * 1000 });
  }

  async consume(state: string): Promise<OidcStateEntry | undefined> {
    const mem = this.store.get(state);
    if (!mem) return undefined;
    this.store.delete(state);
    if (Date.now() > mem.expiresAt) return undefined;
    return mem.entry;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (now > v.expiresAt) this.store.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton + factory
// ---------------------------------------------------------------------------

function createOidcStateStore(): OidcStateStore {
  if (REDIS_URL) {
    logger.info('[oidc-state] Using Redis-backed OIDC state store (shared across replicas)');
    return new RedisOidcStateStore();
  }
  logger.info('[oidc-state] Using in-memory OIDC state store (single-replica mode — not safe for HA)');
  return new MemoryOidcStateStore();
}

/** Singleton OIDC state store. Backend is chosen once at startup from REDIS_URL. */
export const oidcStateStore: OidcStateStore = createOidcStateStore();
