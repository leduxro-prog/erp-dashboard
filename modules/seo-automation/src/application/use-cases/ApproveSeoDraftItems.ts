import { SeoDraftChangesetStatus } from './EnqueueSeoDrafts';

export interface ApproveSeoDraftItemsFilter {
  productId?: number;
  locale?: string;
  status?: SeoDraftChangesetStatus;
  page?: number;
  limit?: number;
  unbounded?: boolean;
}

export interface ApproveSeoDraftItemsInput {
  filter: ApproveSeoDraftItemsFilter;
  decision: 'approved' | 'rejected';
  approvedBy?: number;
}

export interface ApproveSeoDraftItemsOutput {
  matchedCount: number;
  eligibleCount: number;
  updatedCount: number;
}

export interface IApproveSeoDraftItemsRepository {
  findByFilter(filter: ApproveSeoDraftItemsFilter): Promise<Array<{ id: number; status: SeoDraftChangesetStatus }>>;
  updateStatusBulk(input: {
    ids: number[];
    status: 'approved' | 'rejected';
    approvedBy?: number;
  }): Promise<number>;
}

export class ApproveSeoDraftItems {
  constructor(private readonly repository: IApproveSeoDraftItemsRepository) {}

  async execute(input: ApproveSeoDraftItemsInput): Promise<ApproveSeoDraftItemsOutput> {
    const matched = await this.repository.findByFilter({
      ...input.filter,
      unbounded: true,
    });
    const pendingIds = matched.filter((row) => row.status === 'pending').map((row) => row.id);

    if (pendingIds.length === 0) {
      return {
        matchedCount: matched.length,
        eligibleCount: 0,
        updatedCount: 0,
      };
    }

    const updatedCount = await this.repository.updateStatusBulk({
      ids: pendingIds,
      status: input.decision,
      approvedBy: input.approvedBy,
    });

    return {
      matchedCount: matched.length,
      eligibleCount: pendingIds.length,
      updatedCount,
    };
  }
}
