import { PurchaseOrder, POStatus, POLine } from '../entities/PurchaseOrder';
import { IPurchaseOrderRepository } from '../repositories/IPurchaseOrderRepository';
import { IBudgetRepository } from '../repositories/IBudgetRepository';

export class PurchaseOrderService {
  constructor(
    private poRepository: IPurchaseOrderRepository,
    private budgetRepository: IBudgetRepository
  ) {}

  async createFromRequisition(
    requisitionId: string,
    po: PurchaseOrder
  ): Promise<PurchaseOrder> {
    po.poNumber = this.generatePONumber();
    po.status = POStatus.PENDING_APPROVAL;
    const createdPO = await this.poRepository.create(po);
    return createdPO;
  }

  async approvePO(poId: string, approvedBy: string): Promise<void> {
    const po = await this.poRepository.findById(poId);
    if (!po) throw new Error('Purchase Order not found');

    if (!po.canApprove()) {
      throw new Error('Purchase Order cannot be approved in its current status');
    }

    po.status = POStatus.APPROVED;
    po.approvedBy = approvedBy;
    po.approvedAt = new Date();
    await this.poRepository.update(poId, {
      status: POStatus.APPROVED,
      approvedBy,
      approvedAt: po.approvedAt,
    });
  }

  async sendPO(poId: string): Promise<void> {
    const po = await this.poRepository.findById(poId);
    if (!po) throw new Error('Purchase Order not found');

    if (!po.canSend()) {
      throw new Error('Purchase Order cannot be sent in its current status');
    }

    po.status = POStatus.SENT;
    po.sentAt = new Date();
    await this.poRepository.update(poId, {
      status: POStatus.SENT,
      sentAt: po.sentAt,
    });
  }

  async receivePO(poId: string): Promise<void> {
    const po = await this.poRepository.findById(poId);
    if (!po) throw new Error('Purchase Order not found');

    // Check if all lines have been received
    const allLinesReceived = po.lines.every(
      (line) =>
        Math.abs(line.quantity - this.getReceivedQuantity(poId, line.id)) <
        0.01
    );

    if (allLinesReceived) {
      po.status = POStatus.RECEIVED;
    } else {
      po.status = POStatus.PARTIALLY_RECEIVED;
    }

    await this.poRepository.update(poId, { status: po.status });
  }

  async closePO(poId: string): Promise<void> {
    const po = await this.poRepository.findById(poId);
    if (!po) throw new Error('Purchase Order not found');

    if (po.status !== POStatus.RECEIVED && po.status !== POStatus.PARTIALLY_RECEIVED) {
      throw new Error('Only received purchase orders can be closed');
    }

    po.status = POStatus.CLOSED;
    await this.poRepository.update(poId, { status: POStatus.CLOSED });
  }

  async cancelPO(poId: string): Promise<void> {
    const po = await this.poRepository.findById(poId);
    if (!po) throw new Error('Purchase Order not found');

    if (!po.canCancel()) {
      throw new Error('Purchase Order cannot be cancelled in its current status');
    }

    po.status = POStatus.CANCELLED;
    await this.poRepository.update(poId, { status: POStatus.CANCELLED });
  }

  async amendPO(
    poId: string,
    changes: Record<string, any>,
    reason: string,
    amendedBy: string
  ): Promise<void> {
    const po = await this.poRepository.findById(poId);
    if (!po) throw new Error('Purchase Order not found');

    if (!po.canAmend()) {
      throw new Error('Purchase Order cannot be amended in its current status');
    }

    // Track changed fields for revision history
    const changedFields: Record<string, { oldValue: any; newValue: any }> = {};
    for (const [key, newValue] of Object.entries(changes)) {
      const oldValue = (po as any)[key];
      if (oldValue !== newValue) {
        changedFields[key] = { oldValue, newValue };
      }
    }

    // Create revision record
    const revision = {
      id: `rev-${Date.now()}`,
      poId,
      revisionNumber:
        (po.revisions?.length || 0) + 1,
      changedFields,
      reason,
      createdBy: amendedBy,
      createdAt: new Date(),
      status: 'pending' as const,
    };

    await this.poRepository.createRevision(revision);
    await this.poRepository.update(poId, changes);
  }

  async updatePOLine(
    poId: string,
    lineId: string,
    updates: Partial<POLine>
  ): Promise<void> {
    const po = await this.poRepository.findById(poId);
    if (!po) throw new Error('Purchase Order not found');

    if (!po.canAmend()) {
      throw new Error('Cannot modify lines in current PO status');
    }

    await this.poRepository.updateLine(poId, lineId, updates);

    // Recalculate totals
    const lines = await this.poRepository.getLines(poId);
    const newTotal = lines.reduce((sum, line) => sum + line.getTotalAmount(), 0);
    await this.poRepository.update(poId, { totalAmount: newTotal });
  }

  private getReceivedQuantity(poId: string, lineId: string): number {
    // This would be populated from GRNs
    // Stub for now - actual implementation would query GRN data
    return 0;
  }

  generatePONumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now() % 100000;
    return `PO-${year}${month}-${String(timestamp).padStart(5, '0')}`;
  }

  calculatePOTotals(po: PurchaseOrder): {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
  } {
    const subtotal = po.lines.reduce((sum, line) => sum + line.getTotalAmount(), 0);
    const tax = subtotal * (po.lines[0]?.taxRate || 0);
    const shipping = po.shippingCost || 0;
    const discount = po.discountAmount || 0;
    const total = subtotal + tax + shipping - discount;

    return {
      subtotal,
      tax,
      shipping,
      discount,
      total,
    };
  }
}
