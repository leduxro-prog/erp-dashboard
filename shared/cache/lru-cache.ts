/**
 * LRU (Least Recently Used) Cache Implementation
 * Provides O(1) get, set, and delete operations using doubly-linked list + Map
 * Suitable for in-memory caching with configurable max size and TTL
 *
 * @module shared/cache/lru-cache
 */

/**
 * Cache entry with optional TTL (time to live) support
 */
interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
}

/**
 * Node in the doubly-linked list for LRU tracking
 */
interface Node<T> {
  key: string;
  value: T;
  prev?: Node<T>;
  next?: Node<T>;
  expiresAt?: number;
}

/**
 * LRU Cache with O(1) operations
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<{ id: string; name: string }>({
 *   maxSize: 10000,
 *   defaultTTLMs: 300000, // 5 minutes
 * });
 *
 * cache.set('user:1', { id: '1', name: 'John' });
 * const user = cache.get('user:1');
 * ```
 */
export class LRUCache<T = any> {
  private map: Map<string, Node<T>> = new Map();
  private head?: Node<T>; // Most recently used
  private tail?: Node<T>; // Least recently used
  private maxSize: number;
  private defaultTTLMs?: number;

  /**
   * Initialize LRU Cache
   *
   * @param maxSize - Maximum number of items to cache (default: 10000)
   * @param defaultTTLMs - Default TTL in milliseconds (optional)
   */
  constructor({
    maxSize = 10000,
    defaultTTLMs,
  }: {
    maxSize?: number;
    defaultTTLMs?: number;
  } = {}) {
    if (maxSize <= 0) {
      throw new Error('maxSize must be greater than 0');
    }
    this.maxSize = maxSize;
    this.defaultTTLMs = defaultTTLMs;
  }

  /**
   * Get value from cache
   * Moves the accessed node to the head (most recently used)
   *
   * @param key - Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const node = this.map.get(key);

    if (!node) {
      return undefined;
    }

    // Check if entry has expired
    if (node.expiresAt && node.expiresAt < Date.now()) {
      this.deleteNode(node);
      this.map.delete(key);
      return undefined;
    }

    // Move to head (most recently used)
    this.moveToHead(node);

    return node.value;
  }

  /**
   * Set value in cache
   * If key exists, updates and moves to head
   * If cache is full, removes least recently used item
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlMs - Optional TTL in milliseconds (overrides default)
   */
  set(key: string, value: T, ttlMs?: number): void {
    let node = this.map.get(key);

    if (node) {
      // Update existing node
      node.value = value;
      node.expiresAt = ttlMs
        ? Date.now() + ttlMs
        : this.defaultTTLMs
          ? Date.now() + this.defaultTTLMs
          : undefined;
      this.moveToHead(node);
    } else {
      // Create new node
      node = {
        key,
        value,
        expiresAt: ttlMs
          ? Date.now() + ttlMs
          : this.defaultTTLMs
            ? Date.now() + this.defaultTTLMs
            : undefined,
      };
      this.map.set(key, node);
      this.addToHead(node);

      // Remove least recently used if cache is full
      if (this.map.size > this.maxSize) {
        if (this.tail) {
          this.deleteNode(this.tail);
          this.map.delete(this.tail.key);
        }
      }
    }
  }

  /**
   * Delete value from cache
   *
   * @param key - Cache key
   * @returns True if item was deleted, false if not found
   */
  delete(key: string): boolean {
    const node = this.map.get(key);
    if (!node) {
      return false;
    }

    this.deleteNode(node);
    this.map.delete(key);
    return true;
  }

  /**
   * Clear all items from cache
   */
  clear(): void {
    this.map.clear();
    this.head = undefined;
    this.tail = undefined;
  }

  /**
   * Check if key exists in cache
   * Does not update access order
   *
   * @param key - Cache key
   * @returns True if key exists and not expired
   */
  has(key: string): boolean {
    const node = this.map.get(key);
    if (!node) {
      return false;
    }

    if (node.expiresAt && node.expiresAt < Date.now()) {
      this.deleteNode(node);
      this.map.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get current size of cache
   */
  get size(): number {
    return this.map.size;
  }

  /**
   * Get maximum size of cache
   */
  get capacity(): number {
    return this.maxSize;
  }

  /**
   * Get all keys in cache (oldest to newest)
   */
  keys(): string[] {
    const keys: string[] = [];
    let node = this.tail;
    while (node) {
      keys.push(node.key);
      node = node.prev;
    }
    return keys;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    capacity: number;
    utilizationPercent: number;
  } {
    return {
      size: this.map.size,
      capacity: this.maxSize,
      utilizationPercent: (this.map.size / this.maxSize) * 100,
    };
  }

  /**
   * Clean up expired entries
   * Called periodically to maintain cache health
   */
  evictExpired(): number {
    let evicted = 0;
    const now = Date.now();

    const keysToDelete: string[] = [];

    const mapEntries = Array.from(this.map.entries());
    for (const [key, node] of mapEntries) {
      if (node.expiresAt && node.expiresAt < now) {
        keysToDelete.push(key);
        evicted++;
      }
    }

    for (const key of keysToDelete) {
      const node = this.map.get(key);
      if (node) {
        this.deleteNode(node);
        this.map.delete(key);
      }
    }

    return evicted;
  }

  /**
   * Move node to head (most recently used position)
   */
  private moveToHead(node: Node<T>): void {
    if (node === this.head) {
      return; // Already at head
    }

    // Remove from current position
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    // Add to head
    node.prev = undefined;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Add new node to head (most recently used position)
   */
  private addToHead(node: Node<T>): void {
    node.prev = undefined;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Delete node from linked list
   */
  private deleteNode(node: Node<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }
}

export default LRUCache;
