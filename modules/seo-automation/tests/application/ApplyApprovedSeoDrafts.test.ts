import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApplyApprovedSeoDrafts } from '../../src/application/use-cases/ApplyApprovedSeoDrafts';

describe('ApplyApprovedSeoDrafts', () => {
  let txRepository: any;
  let repository: any;
  let useCase: ApplyApprovedSeoDrafts;

  beforeEach(() => {
    txRepository = {
      findApprovedChangesets: jest.fn(),
      applyMetadataPatch: jest.fn(),
      updateProductStateFingerprint: jest.fn(),
      markChangesetApplied: jest.fn(),
    };

    repository = {
      withTransaction: jest.fn(async (run: (repo: any) => Promise<any>) => run(txRepository)),
    };

    useCase = new ApplyApprovedSeoDrafts(repository);
  });

  it('applies only approved selected fields and updates last applied fingerprint', async () => {
    txRepository.findApprovedChangesets.mockResolvedValue([
      {
        id: 10,
        productId: 1001,
        locale: 'ro',
        fingerprint: 'fp-approved',
        status: 'approved',
        items: [
          { fieldName: 'metaTitle', proposedValue: 'Titlu aprobat', isSelected: true },
          { fieldName: 'metaDescription', proposedValue: 'Descriere respinsa', isSelected: false },
        ],
      },
    ]);

    const result = await useCase.execute({ productId: 1001, locale: 'ro' });

    expect(repository.withTransaction).toHaveBeenCalledTimes(1);
    expect(txRepository.applyMetadataPatch).toHaveBeenCalledWith({
      productId: 1001,
      locale: 'ro',
      patch: { metaTitle: 'Titlu aprobat' },
    });
    expect(txRepository.updateProductStateFingerprint).toHaveBeenCalledWith({
      productId: 1001,
      locale: 'ro',
      fingerprint: 'fp-approved',
      changesetId: 10,
    });
    expect(txRepository.markChangesetApplied).toHaveBeenCalledWith({
      changesetId: 10,
    });
    expect(result.appliedCount).toBe(1);
  });
});
