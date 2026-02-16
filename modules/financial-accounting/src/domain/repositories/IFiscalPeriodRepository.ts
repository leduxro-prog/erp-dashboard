import { FiscalPeriod } from '../entities/FiscalPeriod';

export interface IFiscalPeriodRepository {
  create(period: FiscalPeriod): Promise<FiscalPeriod>;
  update(period: FiscalPeriod): Promise<FiscalPeriod>;
  delete(id: string, organizationId: string): Promise<void>;
  findById(id: string, organizationId: string): Promise<FiscalPeriod | null>;
  findByName(periodName: string, fiscalYear: string, organizationId: string): Promise<FiscalPeriod | null>;
  findByFiscalYear(fiscalYear: string, organizationId: string): Promise<FiscalPeriod[]>;
  findAll(organizationId: string): Promise<FiscalPeriod[]>;
  findOpen(organizationId: string): Promise<FiscalPeriod[]>;
  findByDate(date: Date, organizationId: string): Promise<FiscalPeriod | null>;
  getCurrentPeriod(organizationId: string): Promise<FiscalPeriod | null>;
}
