import {
  GoodsReceiptNote,
  GRNStatus,
  GRNLine,
  GRNLineStatus,
  ReturnItem,
} from '../entities/GoodsReceiptNote';
import { IGRNRepository } from '../repositories/IGRNRepository';
import { IPurchaseOrderRepository } from '../repositories/IPurchaseOrderRepository';

export class GRNService {
  constructor(
    private grnRepository: IGRNRepository,
    private poRepository: IPurchaseOrderRepository
  ) { }

  async createGRN(grn: GoodsReceiptNote): Promise<GoodsReceiptNote> {
    grn.grnNumber = this.generateGRNNumber();
    grn.status = GRNStatus.DRAFT;
    const created = await this.grnRepository.create(grn);

    // Add GRN reference to PO
    await this.poRepository.addGRNReference(grn.poId, created.id);

    return created;
  }

  async submitGRN(grnId: string): Promise<void> {
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');

    if (grn.status !== GRNStatus.DRAFT) {
      throw new Error('Only draft GRNs can be submitted');
    }

    // Validate that received quantities don't exceed ordered
    const po = await this.poRepository.findById(grn.poId);
    if (!po) throw new Error('Associated PO not found');

    for (const grnLine of grn.lines) {
      const poLine = po.lines.find((l) => l.id === grnLine.poLineId);
      if (!poLine) throw new Error(`PO line ${grnLine.poLineId} not found`);

      if (grnLine.quantityReceived > poLine.quantity) {
        throw new Error(
          `Received quantity (${grnLine.quantityReceived}) exceeds ordered quantity (${poLine.quantity}) for line ${grnLine.lineNumber}`
        );
      }
    }

    grn.status = GRNStatus.PENDING_INSPECTION;
    await this.grnRepository.update(grnId, { status: GRNStatus.PENDING_INSPECTION });
  }

  async inspectGRN(
    grnId: string,
    inspectorId: string,
    inspectorName: string,
    qualityOk: boolean,
    remarks?: string,
    defectDetails?: string
  ): Promise<void> {
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');

    if (grn.status !== GRNStatus.PENDING_INSPECTION) {
      throw new Error('GRN is not pending inspection');
    }

    grn.inspection = {
      inspectorId,
      inspectorName,
      inspectedAt: new Date(),
      remarks,
      qualityOk,
      defectDetails,
    };

    const newStatus = qualityOk ? GRNStatus.INSPECTED : GRNStatus.FULLY_REJECTED;
    await this.grnRepository.update(grnId, {
      inspection: grn.inspection,
      status: newStatus,
    });
  }

  async acceptGRN(grnId: string): Promise<void> {
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');

    if (!grn.canAccept()) {
      throw new Error('GRN cannot be accepted in its current status');
    }

    grn.status = GRNStatus.ACCEPTED;
    await this.grnRepository.update(grnId, { status: GRNStatus.ACCEPTED });

    // Update PO status
    const po = await this.poRepository.findById(grn.poId);
    if (po) {
      // Update PO line statuses
      for (const grnLine of grn.lines) {
        const poLine = po.lines.find((l) => l.id === grnLine.poLineId);
        if (poLine) {
          const receivedQty = grnLine.quantityReceived;
          if (receivedQty >= poLine.quantity) {
            poLine.status = 'received' as any;
          } else if (receivedQty > 0) {
            poLine.status = 'partially_received' as any;
          }
        }
      }

      // Check if all lines are fully received
      const allReceived = po.lines.every(
        (l) => (l as any).status === 'received'
      );
      if (allReceived) {
        await this.poRepository.update(po.id, { status: 'received' as any });
      } else {
        await this.poRepository.update(po.id, { status: 'partially_received' as any });
      }
    }
  }

  async rejectGRN(grnId: string, reason: string): Promise<void> {
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');

    if (!grn.canReject()) {
      throw new Error('GRN cannot be rejected in its current status');
    }

    grn.status = GRNStatus.FULLY_REJECTED;
    grn.notes = reason;
    await this.grnRepository.update(grnId, {
      status: GRNStatus.FULLY_REJECTED,
      notes: reason,
    });

    // Remove GRN reference from PO
    await this.poRepository.removeGRNReference(grn.poId, grnId);
  }

  async requestReturn(
    grnId: string,
    grnLineId: string,
    quantityToReturn: number,
    reason: string
  ): Promise<void> {
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');

    if (!grn.canReturn()) {
      throw new Error('GRN cannot process returns in its current status');
    }

    const grnLine = grn.lines.find((l) => l.id === grnLineId);
    if (!grnLine) throw new Error('GRN line not found');

    if (quantityToReturn > grnLine.quantityReceived) {
      throw new Error(
        `Cannot return ${quantityToReturn} items. Only ${grnLine.quantityReceived} received`
      );
    }

    const returnItem: ReturnItem = {
      id: `ret-${Date.now()}`,
      grnId,
      grnLineId,
      productId: grnLine.productId,
      productName: grnLine.productName,
      quantityReturned: quantityToReturn,
      unit: grnLine.unit,
      reason,
      returnDate: new Date(),
      status: 'requested',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.grnRepository.addReturnItem(grnId, returnItem);

    // Update line status
    grnLine.quantityRejected += quantityToReturn;
    if (grnLine.quantityRejected > 0) {
      grnLine.status =
        grnLine.quantityRejected === grnLine.quantityReceived
          ? GRNLineStatus.REJECTED
          : GRNLineStatus.PARTIAL_REJECTION;
    }
    await this.grnRepository.updateLine(grnId, grnLineId, {
      quantityRejected: grnLine.quantityRejected,
      status: grnLine.status,
    });
  }

  async approveReturn(
    grnId: string,
    returnId: string,
    approvedBy: string
  ): Promise<void> {
    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');

    const returnItem = grn.returnedItems.find((r) => r.id === returnId);
    if (!returnItem) throw new Error('Return item not found');

    returnItem.status = 'approved';
    returnItem.approvedBy = approvedBy;
    await this.grnRepository.updateReturnItem(grnId, returnId, {
      status: 'approved',
      approvedBy,
    });
  }

  generateGRNNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now() % 100000;
    return `GRN-${year}${month}-${String(timestamp).padStart(5, '0')}`;
  }
}
