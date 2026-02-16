import { DataSource } from 'typeorm';
import { CompatibilityRule } from '../../domain/entities/CompatibilityRule';
import { IRuleRepository } from '../../domain/repositories/IRuleRepository';

export class TypeOrmRuleRepository implements IRuleRepository {
  constructor(private dataSource: DataSource) {}

  async findByConfiguratorType(type: string): Promise<CompatibilityRule[]> {
    return [];
  }

  async findActive(): Promise<CompatibilityRule[]> {
    return [];
  }

  async save(rule: CompatibilityRule): Promise<CompatibilityRule> {
    return rule;
  }

  async delete(id: string): Promise<boolean> {
    return false;
  }

  async findById(id: string): Promise<CompatibilityRule | undefined> {
    return undefined;
  }
}
