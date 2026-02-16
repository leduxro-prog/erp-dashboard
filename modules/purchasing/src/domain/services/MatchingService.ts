import {
  ThreeWayMatch,
  MatchStatus,
  MatchException,
  ExceptionType,
  ToleranceConfig,
} from '../entities/ThreeWayMatch';
import { IMatchRepository } from '../repositories/IMatchRepository';
import { IPurchaseOrderRepository } from '../repositories/IPurchaseOrderRepository';
import { IGRNRepository } from '../repositories/IGRNRepository';
import { IInvoiceRepository } from '../repositories/IInvoiceRepository';

export class MatchingService {
  private defaultTolerances: ToleranceConfig = {
    quantityVariancePercent: 5,
    priceVariancePercent: 3,
    amountVarianceAmount: 100,
    amountVariancePercent: 2,
  };

  constructor(
    private matchRepository: IMatchRepository,
    private poRepository: IPurchaseOrderRepository,
    private grnRepository: IGRNRepository,
    private invoiceRepository: IInvoiceRepository
  ) { }

  async matchThreeWay(
    poId: string,
    grnId: string,
    invoiceId: string,
    matchedBy: string,
    tolerances: Partial<ToleranceConfig> = {}
  ): Promise<ThreeWayMatch> {
    // Fetch all documents
    const po = await this.poRepository.findById(poId);
    if (!po) throw new Error('Purchase Order not found');

    const grn = await this.grnRepository.findById(grnId);
    if (!grn) throw new Error('GRN not found');

    const invoice = await this.invoiceRepository.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    // Verify relationships
    if (grn.poId !== poId) throw new Error('GRN does not belong to this PO');
    if (invoice.poId && invoice.poId !== poId) {
      throw new Error('Invoice does not match this PO');
    }

    const finalTolerances = { ...this.defaultTolerances, ...tolerances };

    // Calculate variances
    const variance = this.calculateVariances(po, grn, invoice);

    // Check for exceptions
    const exceptions = this.identifyExceptions(variance, finalTolerances);

    const match = new ThreeWayMatch({
      id: `match-${Date.now()}`,
      poId,
      poNumber: po.poNumber,
      grnId,
      grnNumber: grn.grnNumber,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      vendorId: po.vendorId,
      vendorName: po.vendorName,
      status: exceptions.length === 0 ? MatchStatus.MATCHED : MatchStatus.EXCEPTION,
      matchedAt: new Date(),
      matchedBy,
      totalPOAmount: po.totalAmount,
      totalGRNAmount: grn.lines.reduce((sum, l) => sum + l.getTotalReceivedAmount(), 0),
      totalInvoiceAmount: invoice.totalInvoicedAmount,
      variance,
      exceptions,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await this.matchRepository.create(match);

    // Update related documents
    if (match.status === MatchStatus.MATCHED) {
      await this.invoiceRepository.addMatchReference(invoiceId, created.id);
      await this.poRepository.addInvoiceReference(poId, invoiceId);
    }

    return created;
  }

  async autoApproveMatches(
    tolerances: Partial<ToleranceConfig> = {}
  ): Promise<string[]> {
    const finalTolerances = { ...this.defaultTolerances, ...tolerances };
    const approved: string[] = [];

    // Get all exception matches
    const matches = await this.matchRepository.findWithExceptions({
      page: 1,
      limit: 1000,
    });

    for (const match of matches.data) {
      if (match.status === MatchStatus.EXCEPTION) {
        if (match.canAutoApprove(finalTolerances)) {
          match.status = MatchStatus.RESOLVED;
          await this.matchRepository.update(match.id, {
            status: MatchStatus.RESOLVED,
          });
          approved.push(match.id);
        }
      }
    }

    return approved;
  }

  async resolveException(
    matchId: string,
    exceptionId: string,
    action: 'approve' | 'reject' | 'request_vendor_adjustment',
    reason: string,
    approvedBy: string,
    adjustmentAmount?: number
  ): Promise<void> {
    const match = await this.matchRepository.findById(matchId);
    if (!match) throw new Error('Match not found');

    const exception = match.exceptions.find((e) => e.id === exceptionId);
    if (!exception) throw new Error('Exception not found');

    exception.status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'escalated';
    exception.resolvedBy = approvedBy;
    exception.resolvedAt = new Date();

    await this.matchRepository.updateException(exceptionId, {
      status: exception.status,
      resolvedBy: approvedBy,
      resolvedAt: new Date(),
    });

    // Check if all exceptions are resolved
    const unresolvedCount = match.exceptions.filter(
      (e) => e.status === 'pending'
    ).length;

    if (unresolvedCount === 0) {
      match.status = MatchStatus.RESOLVED;
      await this.matchRepository.update(matchId, {
        status: MatchStatus.RESOLVED,
      });
    }
  }

  private calculateVariances(
    po: any,
    grn: any,
    invoice: any
  ): ThreeWayMatch['variance'] {
    const poAmount = po.totalAmount;
    const grnAmount = grn.lines.reduce((sum: number, l: any) => sum + l.getTotalReceivedAmount(), 0);
    const invoiceAmount = invoice.totalInvoicedAmount;

    const quantityVariance = grn.lines.reduce(
      (sum: number, l: any) => sum + Math.abs(l.quantityReceived - l.quantityOrdered),
      0
    );
    const quantityVariancePercent =
      (quantityVariance / po.lines.reduce((sum: number, l: any) => sum + l.quantity, 0)) * 100;

    const priceVariance = Math.abs(invoiceAmount - poAmount);
    const priceVariancePercent = (priceVariance / poAmount) * 100;

    const amountVariance = Math.abs(grnAmount - invoiceAmount);
    const amountVariancePercent = (amountVariance / grnAmount) * 100;

    return {
      quantityVariance,
      quantityVariancePercent,
      priceVariance,
      priceVariancePercent,
      amountVariance,
      amountVariancePercent,
    };
  }

  private identifyExceptions(
    variance: ThreeWayMatch['variance'],
    tolerances: ToleranceConfig
  ): MatchException[] {
    const exceptions: MatchException[] = [];

    if (Math.abs(variance.quantityVariancePercent) > tolerances.quantityVariancePercent) {
      exceptions.push(new MatchException({
        id: `ex-${Date.now()}-qty`,
        matchId: '',
        type: ExceptionType.QUANTITY_VARIANCE,
        severity: variance.quantityVariancePercent > 10 ? 'high' : 'medium',
        description: `Quantity variance of ${variance.quantityVariancePercent.toFixed(2)}%`,
        variance: variance.quantityVariancePercent,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }

    if (Math.abs(variance.priceVariancePercent) > tolerances.priceVariancePercent) {
      exceptions.push(new MatchException({
        id: `ex-${Date.now()}-price`,
        matchId: '',
        type: ExceptionType.PRICE_VARIANCE,
        severity: variance.priceVariancePercent > 5 ? 'high' : 'medium',
        description: `Price variance of ${variance.priceVariancePercent.toFixed(2)}%`,
        variance: variance.priceVariancePercent,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }

    const amountThreshold = Math.max(
      tolerances.amountVarianceAmount,
      (tolerances.amountVariancePercent / 100) * variance.quantityVariance
    );

    if (variance.amountVariance > amountThreshold) {
      exceptions.push(new MatchException({
        id: `ex-${Date.now()}-amount`,
        matchId: '',
        type: ExceptionType.AMOUNT_VARIANCE,
        severity: variance.amountVariance > amountThreshold * 2 ? 'high' : 'low',
        description: `Amount variance of ${variance.amountVariance.toFixed(2)}`,
        variance: variance.amountVariance,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }

    return exceptions;
  }
}
