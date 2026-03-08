import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApproveSeoDraftItems } from '../../src/application/use-cases/ApproveSeoDraftItems';

describe('ApproveSeoDraftItems', () => {
  let repository: any;
  let useCase: ApproveSeoDraftItems;

  beforeEach(() => {
    repository = {
      findByFilter: jest.fn(),
      updateStatusBulk: jest.fn(),
    };
    useCase = new ApproveSeoDraftItems(repository);
  });

  it('updates only pending changesets matching filter', async () => {
    repository.findByFilter.mockResolvedValue([
      { id: 1, status: 'pending' },
      { id: 2, status: 'approved' },
      { id: 3, status: 'pending' },
    ]);
    repository.updateStatusBulk.mockResolvedValue(2);

    const result = await useCase.execute({
      filter: { productId: 1001, locale: 'ro' },
      decision: 'approved',
      approvedBy: 99,
    });

    expect(repository.findByFilter).toHaveBeenCalledWith({
      productId: 1001,
      locale: 'ro',
      unbounded: true,
    });

    expect(repository.updateStatusBulk).toHaveBeenCalledWith({
      ids: [1, 3],
      status: 'approved',
      approvedBy: 99,
    });
    expect(result.updatedCount).toBe(2);
    expect(result.eligibleCount).toBe(2);
  });

  it('does not update when no pending changesets match filter', async () => {
    repository.findByFilter.mockResolvedValue([{ id: 2, status: 'approved' }]);

    const result = await useCase.execute({
      filter: { locale: 'en' },
      decision: 'rejected',
      approvedBy: 99,
    });

    expect(repository.findByFilter).toHaveBeenCalledWith({ locale: 'en', unbounded: true });

    expect(repository.updateStatusBulk).not.toHaveBeenCalled();
    expect(result.updatedCount).toBe(0);
    expect(result.eligibleCount).toBe(0);
  });
});
