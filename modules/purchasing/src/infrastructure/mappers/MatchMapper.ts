import {
  ThreeWayMatch,
  MatchException,
} from '../../domain/entities/ThreeWayMatch';
import {
  ThreeWayMatchResponseDTO,
  MatchExceptionResponseDTO,
  VarianceResponseDTO,
} from '../../application/dtos/MatchDTOs';

export class MatchMapper {
  static toDTO(match: ThreeWayMatch): ThreeWayMatchResponseDTO {
    return {
      id: match.id,
      poId: match.poId,
      poNumber: match.poNumber,
      grnId: match.grnId,
      grnNumber: match.grnNumber,
      invoiceId: match.invoiceId,
      invoiceNumber: match.invoiceNumber,
      vendorId: match.vendorId,
      vendorName: match.vendorName,
      status: match.status,
      matchedAt: match.matchedAt,
      matchedBy: match.matchedBy,
      totalPOAmount: match.totalPOAmount,
      totalGRNAmount: match.totalGRNAmount,
      totalInvoiceAmount: match.totalInvoiceAmount,
      variance: this.varianceToDTO(match.variance),
      exceptions: match.exceptions.map((ex) => this.exceptionToDTO(ex)),
      notes: match.notes,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }

  private static varianceToDTO(variance: any): VarianceResponseDTO {
    return {
      quantityVariance: variance.quantityVariance,
      quantityVariancePercent: variance.quantityVariancePercent,
      priceVariance: variance.priceVariance,
      priceVariancePercent: variance.priceVariancePercent,
      amountVariance: variance.amountVariance,
      amountVariancePercent: variance.amountVariancePercent,
    };
  }

  private static exceptionToDTO(exception: MatchException): MatchExceptionResponseDTO {
    return {
      id: exception.id,
      matchId: exception.matchId,
      type: exception.type,
      severity: exception.severity,
      description: exception.description,
      variance: exception.variance,
      poValue: exception.poValue,
      grnValue: exception.grnValue,
      invoiceValue: exception.invoiceValue,
      status: exception.status,
      resolvedBy: exception.resolvedBy,
      resolvedAt: exception.resolvedAt,
      resolutionNotes: exception.resolutionNotes,
      createdAt: exception.createdAt,
      updatedAt: exception.updatedAt,
    };
  }
}
