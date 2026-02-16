/**
 * TypeORM Implementation of B2B Sync Event Repository
 *
 * Manages synchronization events between ERP and B2B Portal using TypeORM.
 *
 * @module B2B Portal - Infrastructure Repositories
 */

import { DataSource, QueryRunner } from 'typeorm';
import * as crypto from 'crypto';
import {
  IB2BSyncEventRepository,
  B2BSyncEvent,
  CreateSyncEventDto,
  UpdateSyncEventDto,
  FindSyncEventsOptions,
  EntityType,
  SyncDirection,
  SyncStatus,
  SyncEventType,
} from '../../domain/repositories/IB2BSyncEventRepository';

export class TypeOrmB2BSyncEventRepository implements IB2BSyncEventRepository {
  constructor(private readonly dataSource: DataSource) {}

  async create(dto: CreateSyncEventDto): Promise<B2BSyncEvent> {
    const id = crypto.randomUUID();
    const now = new Date();

    await this.dataSource.query(
      `INSERT INTO b2b_sync_events (
        id, entity_type, entity_id, b2b_entity_id, event_type, direction,
        payload, status, error_message, retry_count, idempotency_key,
        created_at, updated_at, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        dto.entityType,
        dto.entityId,
        dto.b2bEntityId || null,
        dto.eventType,
        dto.direction,
        dto.payload ? JSON.stringify(dto.payload) : null,
        'pending',
        null,
        0,
        dto.idempotencyKey || null,
        now,
        now,
        null,
      ],
    );

    return this.findById(id) as Promise<B2BSyncEvent>;
  }

  async update(id: string, dto: UpdateSyncEventDto): Promise<B2BSyncEvent> {
    const updates: string[] = ['updated_at = $2'];
    const params: unknown[] = [id, new Date()];
    let paramIndex = 3;

    if (dto.b2bEntityId !== undefined) {
      updates.push(`b2b_entity_id = $${paramIndex}`);
      params.push(dto.b2bEntityId);
      paramIndex++;
    }

    if (dto.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(dto.status);
      paramIndex++;
    }

    if (dto.errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex}`);
      params.push(dto.errorMessage);
      paramIndex++;
    }

    if (dto.retryCount !== undefined) {
      updates.push(`retry_count = $${paramIndex}`);
      params.push(dto.retryCount);
      paramIndex++;
    }

    if (dto.processedAt !== undefined) {
      updates.push(`processed_at = $${paramIndex}`);
      params.push(dto.processedAt);
      paramIndex++;
    }

    if (dto.payload !== undefined) {
      updates.push(`payload = $${paramIndex}`);
      params.push(JSON.stringify(dto.payload));
      paramIndex++;
    }

    await this.dataSource.query(
      `UPDATE b2b_sync_events SET ${updates.join(', ')} WHERE id = $1`,
      params,
    );

    return this.findById(id) as Promise<B2BSyncEvent>;
  }

  async findById(id: string): Promise<B2BSyncEvent | null> {
    const result = await this.dataSource.query(`SELECT * FROM b2b_sync_events WHERE id = $1`, [id]);

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToEvent(result[0]);
  }

  async findByIdempotencyKey(key: string): Promise<B2BSyncEvent | null> {
    const result = await this.dataSource.query(
      `SELECT * FROM b2b_sync_events WHERE idempotency_key = $1 ORDER BY created_at DESC LIMIT 1`,
      [key],
    );

    if (result.length === 0) {
      return null;
    }

    return this.mapRowToEvent(result[0]);
  }

  async findByEntity(entityType: EntityType, entityId: string): Promise<B2BSyncEvent[]> {
    const result = await this.dataSource.query(
      `SELECT * FROM b2b_sync_events WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`,
      [entityType, entityId],
    );

    return result.map((row: unknown) => this.mapRowToEvent(row));
  }

  async findByB2BEntityId(b2bEntityId: string): Promise<B2BSyncEvent[]> {
    const result = await this.dataSource.query(
      `SELECT * FROM b2b_sync_events WHERE b2b_entity_id = $1 ORDER BY created_at DESC`,
      [b2bEntityId],
    );

    return result.map((row: unknown) => this.mapRowToEvent(row));
  }

  async findPendingEvents(maxRetries = 3, before?: Date): Promise<B2BSyncEvent[]> {
    let query = `
      SELECT * FROM b2b_sync_events
      WHERE status IN ('pending', 'retrying')
      AND retry_count < $1
    `;
    const params: any[] = [maxRetries];

    if (before) {
      query += ` AND created_at < $2`;
      params.push(before);
    }

    query += ` ORDER BY created_at ASC LIMIT 100`;

    const result = await this.dataSource.query(query, params);

    return result.map((row: unknown) => this.mapRowToEvent(row));
  }

  async find(options?: FindSyncEventsOptions): Promise<B2BSyncEvent[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.entityType) {
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(options.entityType);
      paramIndex++;
    }

    if (options?.entityId) {
      conditions.push(`entity_id = $${paramIndex}`);
      params.push(options.entityId);
      paramIndex++;
    }

    if (options?.b2bEntityId) {
      conditions.push(`b2b_entity_id = $${paramIndex}`);
      params.push(options.b2bEntityId);
      paramIndex++;
    }

    if (options?.eventType) {
      conditions.push(`event_type = $${paramIndex}`);
      params.push(options.eventType);
      paramIndex++;
    }

    if (options?.direction) {
      conditions.push(`direction = $${paramIndex}`);
      params.push(options.direction);
      paramIndex++;
    }

    if (options?.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    if (options?.idempotencyKey) {
      conditions.push(`idempotency_key = $${paramIndex}`);
      params.push(options.idempotencyKey);
      paramIndex++;
    }

    if (options?.fromDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(options.fromDate);
      paramIndex++;
    }

    if (options?.toDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(options.toDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    params.push(limit, offset);

    const result = await this.dataSource.query(
      `SELECT * FROM b2b_sync_events ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params,
    );

    return result.map((row: unknown) => this.mapRowToEvent(row));
  }

  async count(options?: FindSyncEventsOptions): Promise<number> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options?.entityType) {
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(options.entityType);
      paramIndex++;
    }

    if (options?.entityId) {
      conditions.push(`entity_id = $${paramIndex}`);
      params.push(options.entityId);
      paramIndex++;
    }

    if (options?.b2bEntityId) {
      conditions.push(`b2b_entity_id = $${paramIndex}`);
      params.push(options.b2bEntityId);
      paramIndex++;
    }

    if (options?.eventType) {
      conditions.push(`event_type = $${paramIndex}`);
      params.push(options.eventType);
      paramIndex++;
    }

    if (options?.direction) {
      conditions.push(`direction = $${paramIndex}`);
      params.push(options.direction);
      paramIndex++;
    }

    if (options?.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    if (options?.idempotencyKey) {
      conditions.push(`idempotency_key = $${paramIndex}`);
      params.push(options.idempotencyKey);
      paramIndex++;
    }

    if (options?.fromDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(options.fromDate);
      paramIndex++;
    }

    if (options?.toDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(options.toDate);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM b2b_sync_events ${whereClause}`,
      params,
    );

    return parseInt(result[0]?.count || '0', 10);
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.dataSource.query(
      `DELETE FROM b2b_sync_events WHERE created_at < $1 RETURNING id`,
      [date],
    );

    return result.length;
  }

  async markAsSuccess(id: string, b2bEntityId?: string): Promise<B2BSyncEvent> {
    return this.update(id, {
      b2bEntityId,
      status: 'success',
      processedAt: new Date(),
    });
  }

  async markAsFailed(id: string, errorMessage: string): Promise<B2BSyncEvent> {
    const event = await this.findById(id);
    if (!event) {
      throw new Error(`Sync event not found: ${id}`);
    }

    return this.update(id, {
      status: 'failed',
      errorMessage,
      retryCount: event.retryCount + 1,
    });
  }

  async incrementRetry(id: string): Promise<B2BSyncEvent> {
    const event = await this.findById(id);
    if (!event) {
      throw new Error(`Sync event not found: ${id}`);
    }

    return this.update(id, {
      status: 'retrying',
      retryCount: event.retryCount + 1,
    });
  }

  async withTransaction<T>(
    fn: (repo: IB2BSyncEventRepository, runner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create a new repository instance with the transaction runner
      const transactionalRepo = new TypeOrmB2BSyncEventRepository(
        // Use the transaction connection
        {
          query: (query: string, params?: unknown[]) => queryRunner.query(query, params),
        } as any,
      );

      const result = await fn(transactionalRepo, queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private mapRowToEvent(row: any): B2BSyncEvent {
    return {
      id: row.id,
      entityType: row.entity_type as EntityType,
      entityId: row.entity_id,
      b2bEntityId: row.b2b_entity_id || undefined,
      eventType: row.event_type as SyncEventType,
      direction: row.direction as SyncDirection,
      payload: row.payload
        ? typeof row.payload === 'string'
          ? JSON.parse(row.payload)
          : row.payload
        : undefined,
      status: row.status as SyncStatus,
      errorMessage: row.error_message || undefined,
      retryCount: row.retry_count || 0,
      idempotencyKey: row.idempotency_key || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
    };
  }
}
