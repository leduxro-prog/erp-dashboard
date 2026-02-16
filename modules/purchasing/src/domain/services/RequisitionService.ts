import {
  PurchaseRequisition,
  RequisitionStatus,
  RequisitionApprovalStep,
} from '../entities/PurchaseRequisition';
import { IRequisitionRepository } from '../repositories/IRequisitionRepository';
import { IBudgetRepository } from '../repositories/IBudgetRepository';

export class RequisitionService {
  constructor(
    private requisitionRepository: IRequisitionRepository,
    private budgetRepository: IBudgetRepository
  ) {}

  async submitRequisition(
    requisitionId: string,
    submittedBy: string
  ): Promise<void> {
    const requisition = await this.requisitionRepository.findById(
      requisitionId
    );
    if (!requisition) throw new Error('Requisition not found');

    if (!requisition.canSubmit()) {
      throw new Error(
        'Requisition cannot be submitted in its current status'
      );
    }

    // Validate budget
    if (requisition.budgetCode) {
      const budget = await this.budgetRepository.findByCode(
        requisition.budgetCode
      );
      if (!budget) throw new Error('Budget code not found');

      const totalAmount = requisition.getTotalAmount();
      if (!budget.canAllocate(totalAmount)) {
        throw new Error(
          `Budget insufficient. Requested: ${totalAmount}, Available: ${budget.getRemainingAmount()}`
        );
      }

      // Reserve the amount
      budget.reservedAmount += totalAmount;
      await this.budgetRepository.update(budget.id, {
        reservedAmount: budget.reservedAmount,
      });
    }

    // Update status and create first approval step
    requisition.status = RequisitionStatus.SUBMITTED;
    await this.requisitionRepository.update(requisitionId, {
      status: RequisitionStatus.SUBMITTED,
    });
  }

  async approveRequisition(
    requisitionId: string,
    approverId: string,
    approverName: string,
    approvalLevel: number,
    comments?: string
  ): Promise<boolean> {
    const requisition = await this.requisitionRepository.findById(
      requisitionId
    );
    if (!requisition) throw new Error('Requisition not found');

    if (!requisition.canApprove()) {
      throw new Error('Requisition cannot be approved in its current status');
    }

    const approval: RequisitionApprovalStep = {
      id: `approval-${Date.now()}`,
      requisitionId,
      approverLevel: approvalLevel,
      approverId,
      approverName,
      status: 'approved',
      comments,
      approvedAt: new Date(),
    };

    await this.requisitionRepository.addApprovalStep(requisitionId, approval);

    // If all required approvals are done, auto-approve
    const allApprovals = await this.requisitionRepository.getApprovalSteps(
      requisitionId
    );
    const allApproved = allApprovals.every((a) => a.status === 'approved');

    if (allApproved) {
      requisition.status = RequisitionStatus.APPROVED;
      await this.requisitionRepository.update(requisitionId, {
        status: RequisitionStatus.APPROVED,
      });
      return true; // Ready for conversion to PO
    }

    return false;
  }

  async rejectRequisition(
    requisitionId: string,
    approverId: string,
    approverName: string,
    rejectionReason: string
  ): Promise<void> {
    const requisition = await this.requisitionRepository.findById(
      requisitionId
    );
    if (!requisition) throw new Error('Requisition not found');

    const approval: RequisitionApprovalStep = {
      id: `approval-${Date.now()}`,
      requisitionId,
      approverLevel: 1,
      approverId,
      approverName,
      status: 'rejected',
      rejectionReason,
    };

    await this.requisitionRepository.addApprovalStep(requisitionId, approval);

    requisition.status = RequisitionStatus.REJECTED;
    await this.requisitionRepository.update(requisitionId, {
      status: RequisitionStatus.REJECTED,
    });

    // Release reserved budget
    if (requisition.budgetCode) {
      const budget = await this.budgetRepository.findByCode(
        requisition.budgetCode
      );
      if (budget) {
        const totalAmount = requisition.getTotalAmount();
        budget.reservedAmount = Math.max(0, budget.reservedAmount - totalAmount);
        await this.budgetRepository.update(budget.id, {
          reservedAmount: budget.reservedAmount,
        });
      }
    }
  }

  async cancelRequisition(requisitionId: string): Promise<void> {
    const requisition = await this.requisitionRepository.findById(
      requisitionId
    );
    if (!requisition) throw new Error('Requisition not found');

    if (!requisition.canCancel()) {
      throw new Error('Requisition cannot be cancelled in its current status');
    }

    requisition.status = RequisitionStatus.CANCELLED;
    await this.requisitionRepository.update(requisitionId, {
      status: RequisitionStatus.CANCELLED,
    });

    // Release reserved budget
    if (requisition.budgetCode) {
      const budget = await this.budgetRepository.findByCode(
        requisition.budgetCode
      );
      if (budget) {
        const totalAmount = requisition.getTotalAmount();
        budget.reservedAmount = Math.max(0, budget.reservedAmount - totalAmount);
        await this.budgetRepository.update(budget.id, {
          reservedAmount: budget.reservedAmount,
        });
      }
    }
  }

  generateRequisitionNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now() % 100000;
    return `REQ-${year}${month}-${String(timestamp).padStart(5, '0')}`;
  }
}
