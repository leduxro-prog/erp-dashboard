export class FiscalPeriod {
  id!: string;
  organizationId!: string;
  periodName!: string;
  fiscalYear!: string;
  startDate!: Date;
  endDate!: Date;
  isOpen!: boolean;
  isLocked!: boolean;
  closingDate?: Date;
  closedBy?: string;
  metadata!: Record<string, any>;
  createdAt!: Date;
  updatedAt!: Date;
  createdBy!: string;
  updatedBy!: string;

  constructor(data: Partial<FiscalPeriod>) {
    Object.assign(this, data);
    this.isOpen = this.isOpen ?? true;
    this.isLocked = this.isLocked ?? false;
    this.metadata = this.metadata ?? {};
  }

  validate(): void {
    if (!this.organizationId) throw new Error('Organization ID is required');
    if (!this.periodName) throw new Error('Period name is required');
    if (!this.fiscalYear) throw new Error('Fiscal year is required');
    if (!this.startDate) throw new Error('Start date is required');
    if (!this.endDate) throw new Error('End date is required');
    if (this.startDate > this.endDate) throw new Error('Start date cannot be after end date');
    if (!/^\d{4}$/.test(this.fiscalYear)) throw new Error('Fiscal year must be a 4-digit year');
  }

  canClose(): boolean {
    return this.isOpen && !this.isLocked;
  }

  canLock(): boolean {
    return !this.isOpen && !this.isLocked;
  }

  canReopen(): boolean {
    return !this.isOpen && !this.isLocked;
  }

  getDurationInDays(): number {
    return Math.ceil((this.endDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  isDateInPeriod(date: Date): boolean {
    return date >= this.startDate && date <= this.endDate;
  }

  getQuarter(): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
    const month = parseInt(this.periodName.substring(1, 3), 10);
    if (month >= 1 && month <= 3) return 'Q1';
    if (month >= 4 && month <= 6) return 'Q2';
    if (month >= 7 && month <= 9) return 'Q3';
    return 'Q4';
  }

  getMonthNumber(): number {
    const match = this.periodName.match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
  }
}
