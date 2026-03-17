import { describe, expect, it } from '@jest/globals';

import { ApInvoice, ApInvoiceStatus } from '../../src/domain/entities/ApInvoice';
import { IApInvoiceRepository } from '../../src/domain/repositories/IApInvoiceRepository';
import { OnPurchasingInvoiceApproved } from '../../src/application/handlers/OnPurchasingInvoiceApproved';

class InMemoryApInvoiceRepository implements IApInvoiceRepository {
  private readonly byNumber = new Map<string, ApInvoice>();
  public createdCount = 0;

  async create(invoice: ApInvoice): Promise<ApInvoice> {
    this.byNumber.set(`${invoice.organizationId}:${invoice.invoiceNumber}`, invoice);
    this.createdCount += 1;
    return invoice;
  }

  async update(invoice: ApInvoice): Promise<ApInvoice> { return invoice; }
  async delete(): Promise<void> {}
  async findById(): Promise<ApInvoice | null> { return null; }
  async findByNumber(invoiceNumber: string, organizationId: string): Promise<ApInvoice | null> {
    return this.byNumber.get(`${organizationId}:${invoiceNumber}`) || null;
  }
  async findByVendor(): Promise<ApInvoice[]> { return []; }
  async findByStatus(): Promise<ApInvoice[]> { return []; }
  async findByDateRange(): Promise<ApInvoice[]> { return []; }
  async findOverdue(): Promise<ApInvoice[]> { return []; }
  async findUnpaid(): Promise<ApInvoice[]> { return []; }
  async findUnmatched(): Promise<ApInvoice[]> { return []; }
  async findByPoNumber(): Promise<ApInvoice[]> { return []; }
  async getNextInvoiceNumber(): Promise<string> { return 'TEST-1'; }
  async getAgeingSummary(): Promise<Map<string, number>> { return new Map(); }
}

describe('OnPurchasingInvoiceApproved', () => {
  it('creates AP invoice idempotently for repeated events', async () => {
    const repository = new InMemoryApInvoiceRepository();
    const handler = new OnPurchasingInvoiceApproved(repository);

    const event = {
      invoiceId: 'pinv-1',
      invoiceNumber: 'PINV-2026-1',
      vendorId: 'vendor-1',
      vendorName: 'Vendor One',
      totalAmount: 250,
      currency: 'RON',
      approvedAt: '2026-03-17T00:00:00.000Z',
    };

    await handler.handle(event);
    await handler.handle(event);

    expect(repository.createdCount).toBe(1);

    const created = await repository.findByNumber(
      event.invoiceNumber,
      process.env.DEFAULT_ORGANIZATION_ID || '00000000-0000-0000-0000-000000000001',
    );
    expect(created).not.toBeNull();
    expect(created?.status).toBe(ApInvoiceStatus.RECEIVED);
  });
});
