import { CostCenter } from '../entities/CostCenter';

export interface ICostCenterRepository {
  create(costCenter: CostCenter): Promise<CostCenter>;
  update(costCenter: CostCenter): Promise<CostCenter>;
  delete(id: string, organizationId: string): Promise<void>;
  findById(id: string, organizationId: string): Promise<CostCenter | null>;
  findByCode(code: string, organizationId: string): Promise<CostCenter | null>;
  findAll(organizationId: string, filters?: { isActive?: boolean }): Promise<CostCenter[]>;
}
