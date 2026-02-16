/**
 * List Email Sequences Use-Case
 *
 * Lists all email sequences with optional filtering.
 *
 * @module marketing/application/use-cases
 */

export interface ListEmailSequencesRequest {
  campaignId?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  triggerEvent?: string;
  page?: number;
  limit?: number;
}

export interface ListEmailSequencesResponse {
  sequences: Array<{
    id: string;
    name: string;
    campaignId: string;
    triggerEvent: string;
    status: string;
    stepCount: number;
    enrolledCount: number;
    completedCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * List Email Sequences Use-Case.
 *
 * Application service for listing email sequences.
 *
 * @class ListEmailSequences
 */
export class ListEmailSequences {
  constructor(private readonly sequenceRepository: any) {}

  async execute(request: ListEmailSequencesRequest = {}): Promise<ListEmailSequencesResponse> {
    const { campaignId, status, triggerEvent, page = 1, limit = 20 } = request;

    const whereClause: any = {};
    if (campaignId) whereClause.campaignId = campaignId;
    if (status) whereClause.status = status;
    if (triggerEvent) whereClause.triggerEvent = triggerEvent;

    const [sequences, total] = await this.sequenceRepository.findAndCount({
      where: whereClause,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      sequences: sequences.map((s: any) => ({
        id: s.id,
        name: s.name,
        campaignId: s.campaignId,
        triggerEvent: s.triggerEvent,
        status: s.status,
        stepCount: s.steps?.length || 0,
        enrolledCount: s.enrolledCount || 0,
        completedCount: s.completedCount || 0,
        createdAt: s.createdAt?.toISOString(),
        updatedAt: s.updatedAt?.toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
