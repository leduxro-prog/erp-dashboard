import { describe, expect, it } from '@jest/globals';

import { InvoiceUseCases } from '../../src/application/use-cases/InvoiceUseCases';
import { InvoiceService } from '../../src/domain/services/InvoiceService';
import { InvoiceStatus, VendorInvoice } from '../../src/domain/entities/VendorInvoice';
import { IInvoiceRepository } from '../../src/domain/repositories/IInvoiceRepository';

class InMemoryInvoiceRepositoryForTest implements IInvoiceRepository {
  private store = new Map<string, VendorInvoice>();

  constructor(invoice: VendorInvoice) {
    this.store.set(invoice.id, invoice);
  }

  async create(invoice: VendorInvoice): Promise<VendorInvoice> { this.store.set(invoice.id, invoice); return invoice; }
  async findById(id: string): Promise<VendorInvoice | null> { return this.store.get(id) || null; }
  async findByNumber(): Promise<VendorInvoice | null> { return null; }
  async findByVendorInvoiceNumber(): Promise<VendorInvoice | null> { return null; }
  async findByVendor(): Promise<any> { return { data: [], total: 0, page: 1, limit: 20, hasMore: false }; }
  async findByPO(): Promise<VendorInvoice[]> { return []; }
  async findByStatus(): Promise<any> { return { data: [], total: 0, page: 1, limit: 20, hasMore: false }; }
  async findByDisputeStatus(): Promise<any> { return { data: [], total: 0, page: 1, limit: 20, hasMore: false }; }
  async findDueSoon(): Promise<VendorInvoice[]> { return []; }
  async findOverdue(): Promise<VendorInvoice[]> { return []; }
  async findAll(): Promise<any> { return { data: [], total: 0, page: 1, limit: 20, hasMore: false }; }
  async update(id: string, updates: Partial<VendorInvoice>): Promise<void> {
    const current = this.store.get(id);
    if (!current) return;
    Object.assign(current, updates);
  }
  async delete(): Promise<void> {}
  async addLine(): Promise<void> {}
  async updateLine(): Promise<void> {}
  async removeLine(): Promise<void> {}
  async getLines(): Promise<any[]> { return []; }
  async addMatchReference(invoiceId: string, matchId: string): Promise<void> {
    const current = this.store.get(invoiceId);
    if (!current) return;
    current.matchReferences = [...(current.matchReferences || []), matchId];
  }
  async removeMatchReference(): Promise<void> {}
  async getMatchReferences(): Promise<string[]> { return []; }
  async existsByNumber(): Promise<boolean> { return false; }
  async countByVendor(): Promise<number> { return 0; }
  async countByStatus(): Promise<number> { return 0; }
  async countDuplicate(): Promise<number> { return 0; }
}

describe('Invoice approval event publishing', () => {
  it('publishes purchasing.invoice.approved after invoice is approved for payment', async () => {
    const invoice = new VendorInvoice({
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0001',
      invoiceDate: new Date('2026-03-01T00:00:00.000Z'),
      vendorId: 'vendor-1',
      vendorName: 'Vendor One',
      vendorInvoiceNumber: 'V-1',
      vendorInvoiceDate: new Date('2026-03-01T00:00:00.000Z'),
      receivedDate: new Date('2026-03-02T00:00:00.000Z'),
      dueDate: new Date('2026-04-01T00:00:00.000Z'),
      status: InvoiceStatus.MATCHED,
      currency: 'RON',
      subtotalAmount: 100,
      taxAmount: 0,
      shippingAmount: 0,
      otherCharges: 0,
      discountAmount: 0,
      totalInvoicedAmount: 100,
      totalMatchedAmount: 100,
      remainingAmount: 100,
      registeredBy: 'tester',
      paidAmount: 0,
      dispatchStatus: 'none' as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [],
      matchReferences: [],
    });

    const repository = new InMemoryInvoiceRepositoryForTest(invoice);
    const service = new InvoiceService(repository);
    const published: any[] = [];

    const useCases = new InvoiceUseCases(service, repository, {
      publishInvoiceApproved: async (event) => {
        published.push(event);
      },
    });

    await useCases.approveForPayment(invoice.id);

    expect(published).toHaveLength(1);
    expect(published[0]).toEqual(
      expect.objectContaining({
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-2026-0001',
        vendorId: 'vendor-1',
        totalAmount: 100,
        currency: 'RON',
      }),
    );
  });
});
