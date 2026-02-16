/**
 * B2B Sync Event Repository Interface
 *
 * Manages synchronization events between ERP and B2B Portal.
 * Provides idempotency tracking and audit trail for sync operations.
 *
 * @module B2B Portal - Domain Repositories
 */

import { QueryRunner } from 'typeorm';

export type EntityType = 'order' | 'invoice' | 'customer';
export type SyncDirection = 'outbound' | 'inbound';
export type SyncStatus = 'pending' | 'success' | 'failed' | 'retrying';
export type SyncEventType = 'create' | 'update' | 'delete' | 'status_change' | 'query';

export interface B2BSyncEvent {
  /**
   * Unique event identifier
   */
  id: string;

  /**
   * Type of entity being synced
   */
  entityType: EntityType;

  /**
   * Internal entity ID
   */
  entityId: string;

  /**
   * External B2B Portal entity ID
   */
  b2bEntityId?: string;

  /**
   * Type of sync event
   */
  eventType: SyncEventType;

  /**
   * Direction of sync (outbound: ERP->B2B, inbound: B2B->ERP)
   */
  direction: SyncDirection;

  /**
   * Payload data (request/response)
   */
  payload?: Record<string, unknown>;

  /**
   * Current status of the sync event
   */
  status: SyncStatus;

  /**
   * Error message if sync failed
   */
  errorMessage?: string;

  /**
   * Number of retry attempts
   */
  retryCount: number;

  /**
   * Idempotency key for duplicate prevention
   */
  idempotencyKey?: string;

  /**
   * Event creation timestamp
   */
  createdAt: Date;

  /**
   * Event last update timestamp
   */
  updatedAt: Date;

  /**
   * Event processing timestamp
   */
  processedAt?: Date;
}

export interface CreateSyncEventDto {
  entityType: EntityType;
  entityId: string;
  b2bEntityId?: string;
  eventType: SyncEventType;
  direction: SyncDirection;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface UpdateSyncEventDto {
  b2bEntityId?: string;
  status?: SyncStatus;
  errorMessage?: string;
  retryCount?: number;
  processedAt?: Date;
  payload?: Record<string, unknown>;
}

export interface FindSyncEventsOptions {
  entityType?: EntityType;
  entityId?: string;
  b2bEntityId?: string;
  eventType?: SyncEventType;
  direction?: SyncDirection;
  status?: SyncStatus;
  idempotencyKey?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * B2B Sync Event Repository Interface
 */
export interface IB2BSyncEventRepository {
  /**
   * Create a new sync event
   */
  create(dto: CreateSyncEventDto): Promise<B2BSyncEvent>;

  /**
   * Update an existing sync event
   */
  update(id: string, dto: UpdateSyncEventDto): Promise<B2BSyncEvent>;

  /**
   * Find sync event by ID
   */
  findById(id: string): Promise<B2BSyncEvent | null>;

  /**
   * Find sync event by idempotency key
   */
  findByIdempotencyKey(key: string): Promise<B2BSyncEvent | null>;

  /**
   * Find sync events by entity
   */
  findByEntity(entityType: EntityType, entityId: string): Promise<B2BSyncEvent[]>;

  /**
   * Find sync events by B2B entity ID
   */
  findByB2BEntityId(b2bEntityId: string): Promise<B2BSyncEvent[]>;

  /**
   * Find pending sync events for retry
   */
  findPendingEvents(maxRetries?: number, before?: Date): Promise<B2BSyncEvent[]>;

  /**
   * Find sync events with filters
   */
  find(options?: FindSyncEventsOptions): Promise<B2BSyncEvent[]>;

  /**
   * Count sync events with filters
   */
  count(options?: FindSyncEventsOptions): Promise<number>;

  /**
   * Delete old sync events
   */
  deleteOlderThan(date: Date): Promise<number>;

  /**
   * Mark event as successful
   */
  markAsSuccess(id: string, b2bEntityId?: string): Promise<B2BSyncEvent>;

  /**
   * Mark event as failed
   */
  markAsFailed(id: string, errorMessage: string): Promise<B2BSyncEvent>;

  /**
   * Increment retry count
   */
  incrementRetry(id: string): Promise<B2BSyncEvent>;

  /**
   * Use transaction for batch operations
   */
  withTransaction<T>(fn: (repo: IB2BSyncEventRepository, runner: QueryRunner) => Promise<T>): Promise<T>;
}
