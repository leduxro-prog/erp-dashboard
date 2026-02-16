/**
 * TypeORM NotificationPreference Repository
 * Implements IPreferenceRepository using TypeORM
 */
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'winston';
import { NotificationPreference } from '../../domain/entities/NotificationPreference';
import { IPreferenceRepository } from '../../domain/repositories/IPreferenceRepository';
import { NotificationPreferenceEntity } from '../entities/NotificationPreferenceEntity';

/**
 * TypeORM implementation of IPreferenceRepository
 */
export class TypeOrmPreferenceRepository implements IPreferenceRepository {
  private repository: Repository<NotificationPreferenceEntity>;
  private logger: Logger;

  constructor(dataSource: DataSource, logger: Logger) {
    this.repository = dataSource.getRepository(NotificationPreferenceEntity);
    this.logger = logger;
  }

  async save(preference: NotificationPreference): Promise<NotificationPreference> {
    try {
      const props = preference.toJSON();
      const entity = this.repository.create({
        id: props.id,
        customerId: props.customerId,
        channel: props.channel,
        isEnabled: props.isEnabled,
        quietHoursStart: props.quietHoursStart,
        quietHoursEnd: props.quietHoursEnd,
        frequency: props.frequency,
      });
      await this.repository.save(entity);
      return preference;
    } catch (error) {
      this.logger.error('Error saving preference', {
        preferenceId: preference.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async update(preference: NotificationPreference): Promise<NotificationPreference> {
    try {
      const props = preference.toJSON();
      await this.repository.update(
        { id: props.id },
        {
          isEnabled: props.isEnabled,
          quietHoursStart: props.quietHoursStart,
          quietHoursEnd: props.quietHoursEnd,
          frequency: props.frequency,
        }
      );
      return preference;
    } catch (error) {
      this.logger.error('Error updating preference', {
        preferenceId: preference.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findById(id: string): Promise<NotificationPreference | null> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) return null;

      return new NotificationPreference({
        id: entity.id,
        customerId: entity.customerId,
        channel: entity.channel as any,
        isEnabled: entity.isEnabled,
        quietHoursStart: entity.quietHoursStart,
        quietHoursEnd: entity.quietHoursEnd,
        frequency: entity.frequency as any,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      });
    } catch (error) {
      this.logger.error('Error finding preference by ID', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByCustomerId(customerId: string): Promise<NotificationPreference[]> {
    try {
      const entities = await this.repository.find({ where: { customerId } });
      return entities.map((e) => new NotificationPreference({
        id: e.id,
        customerId: e.customerId,
        channel: e.channel as any,
        isEnabled: e.isEnabled,
        quietHoursStart: e.quietHoursStart,
        quietHoursEnd: e.quietHoursEnd,
        frequency: e.frequency as any,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
    } catch (error) {
      this.logger.error('Error finding preferences by customer ID', {
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findByCustomerAndChannel(
    customerId: string,
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH'
  ): Promise<NotificationPreference | null> {
    try {
      const entity = await this.repository.findOne({
        where: { customerId, channel },
      });
      if (!entity) return null;

      return new NotificationPreference({
        id: entity.id,
        customerId: entity.customerId,
        channel: entity.channel as any,
        isEnabled: entity.isEnabled,
        quietHoursStart: entity.quietHoursStart,
        quietHoursEnd: entity.quietHoursEnd,
        frequency: entity.frequency as any,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      });
    } catch (error) {
      this.logger.error('Error finding preference by customer and channel', {
        customerId,
        channel,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async upsert(preference: NotificationPreference): Promise<NotificationPreference> {
    try {
      const existing = await this.findByCustomerAndChannel(
        preference.toJSON().customerId,
        preference.toJSON().channel as any
      );

      if (existing) {
        return this.update(preference);
      } else {
        return this.save(preference);
      }
    } catch (error) {
      this.logger.error('Error upserting preference', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async delete(id: string): Promise<number> {
    try {
      const result = await this.repository.delete({ id });
      return result.affected || 0;
    } catch (error) {
      this.logger.error('Error deleting preference', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findEnabledByChannel(
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH'
  ): Promise<NotificationPreference[]> {
    try {
      const entities = await this.repository.find({
        where: { channel, isEnabled: true },
      });
      return entities.map((e) => new NotificationPreference({
        id: e.id,
        customerId: e.customerId,
        channel: e.channel as any,
        isEnabled: e.isEnabled,
        quietHoursStart: e.quietHoursStart,
        quietHoursEnd: e.quietHoursEnd,
        frequency: e.frequency as any,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
    } catch (error) {
      this.logger.error('Error finding enabled preferences by channel', {
        channel,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async countEnabledByChannel(): Promise<Record<string, number>> {
    try {
      const result = await this.repository.query(`
        SELECT channel, COUNT(*) as count
        FROM notification_preferences
        WHERE "isEnabled" = true
        GROUP BY channel
      `);

      const counts: Record<string, number> = {};
      for (const row of result) {
        counts[row.channel] = parseInt(row.count, 10);
      }
      return counts;
    } catch (error) {
      this.logger.error('Error counting enabled preferences by channel', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
