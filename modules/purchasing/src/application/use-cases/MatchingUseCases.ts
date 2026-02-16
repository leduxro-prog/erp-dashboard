import {
  CreateThreeWayMatchDTO,
  ThreeWayMatchResponseDTO,
  PaginatedMatchResponseDTO,
  ResolveExceptionDTO,
  MatchAnalyticsDTO,
} from '../dtos/MatchDTOs';
import { MatchingService } from '../../domain/services/MatchingService';
import { IMatchRepository } from '../../domain/repositories/IMatchRepository';
import { MatchMapper } from '../../infrastructure/mappers/MatchMapper';
import { MatchStatus } from '../../domain/entities/ThreeWayMatch';

export class MatchingUseCases {
  constructor(
    private matchingService: MatchingService,
    private matchRepository: IMatchRepository
  ) { }

  async createMatch(dto: CreateThreeWayMatchDTO): Promise<ThreeWayMatchResponseDTO> {
    const match = await this.matchingService.matchThreeWay(
      dto.poId,
      dto.grnId,
      dto.invoiceId,
      dto.matchedBy,
      dto.tolerances
    );

    return MatchMapper.toDTO(match);
  }

  async autoApproveMatches(): Promise<string[]> {
    return await this.matchingService.autoApproveMatches();
  }

  async resolveException(dto: ResolveExceptionDTO): Promise<ThreeWayMatchResponseDTO> {
    await this.matchingService.resolveException(
      dto.matchId,
      dto.exceptionId,
      dto.action,
      dto.reason,
      dto.approvedBy,
      dto.adjustmentAmount
    );

    const match = await this.matchRepository.findById(dto.matchId);
    if (!match) throw new Error('Match not found');

    return MatchMapper.toDTO(match);
  }

  async getMatch(matchId: string): Promise<ThreeWayMatchResponseDTO> {
    const match = await this.matchRepository.findById(matchId);
    if (!match) throw new Error('Match not found');
    return MatchMapper.toDTO(match);
  }

  async getMatchByPO(poId: string): Promise<ThreeWayMatchResponseDTO[]> {
    const matches = await this.matchRepository.findByPO(poId);
    return matches.map((m) => MatchMapper.toDTO(m));
  }

  async getMatchByGRN(grnId: string): Promise<ThreeWayMatchResponseDTO | null> {
    const match = await this.matchRepository.findByGRN(grnId);
    if (!match) return null;
    return MatchMapper.toDTO(match);
  }

  async getMatchByInvoice(invoiceId: string): Promise<ThreeWayMatchResponseDTO | null> {
    const match = await this.matchRepository.findByInvoice(invoiceId);
    if (!match) return null;
    return MatchMapper.toDTO(match);
  }

  async listWithExceptions(
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedMatchResponseDTO> {
    const result = await this.matchRepository.findWithExceptions({
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((m) => MatchMapper.toDTO(m)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  }

  async listAll(page: number = 1, limit: number = 20): Promise<PaginatedMatchResponseDTO> {
    const result = await this.matchRepository.findAll({
      page,
      limit,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    return {
      data: result.data.map((m) => MatchMapper.toDTO(m)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: result.hasMore,
    };
  }

  async getAnalytics(): Promise<MatchAnalyticsDTO> {
    const total = await this.matchRepository.countByStatus(MatchStatus.MATCHED);
    const exceptions = await this.matchRepository.countWithExceptions();
    const resolved = await this.matchRepository.countByStatus(MatchStatus.RESOLVED);

    return {
      totalMatches: total,
      matchedCount: total - exceptions,
      exceptionCount: exceptions,
      resolvedCount: resolved,
      pendingExceptionsCount: exceptions - resolved,
      averageQuantityVariance: 0,
      averagePriceVariance: 0,
      averageAmountVariance: 0,
      matchRate: (((total - exceptions) / total) * 100) || 0,
    };
  }
}
