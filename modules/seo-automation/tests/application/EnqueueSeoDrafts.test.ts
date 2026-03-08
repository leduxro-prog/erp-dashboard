import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EnqueueSeoDrafts } from '../../src/application/use-cases/EnqueueSeoDrafts';

describe('EnqueueSeoDrafts', () => {
  let repository: any;
  let useCase: EnqueueSeoDrafts;

  beforeEach(() => {
    repository = {
      findActiveByFingerprint: jest.fn(),
      createChangeset: jest.fn(),
    };
    useCase = new EnqueueSeoDrafts(repository);
  });

  it('returns existing active changeset for same product+locale+fingerprint', async () => {
    const existing = {
      id: 12,
      productId: 101,
      locale: 'ro',
      fingerprint: 'fp-1',
      status: 'pending',
      isActive: true,
      items: [{ fieldName: 'metaTitle', proposedValue: 'Titlu nou', isSelected: true }],
    };

    repository.findActiveByFingerprint.mockResolvedValue(existing);

    const result = await useCase.execute({
      productId: 101,
      locale: 'ro',
      fingerprint: 'fp-1',
      createdBy: 7,
      items: [{ fieldName: 'metaTitle', currentValue: 'Titlu vechi', proposedValue: 'Titlu nou' }],
    });

    expect(result.created).toBe(false);
    expect(result.changeset.id).toBe(12);
    expect(repository.createChangeset).not.toHaveBeenCalled();
  });

  it('creates a new active changeset when fingerprint does not exist', async () => {
    repository.findActiveByFingerprint.mockResolvedValue(null);
    repository.createChangeset.mockResolvedValue({
      id: 13,
      productId: 101,
      locale: 'ro',
      fingerprint: 'fp-2',
      status: 'pending',
      isActive: true,
      items: [{ fieldName: 'metaDescription', proposedValue: 'Descriere noua', isSelected: true }],
    });

    const result = await useCase.execute({
      productId: 101,
      locale: 'ro',
      fingerprint: 'fp-2',
      createdBy: 7,
      items: [
        {
          fieldName: 'metaDescription',
          currentValue: 'Descriere veche',
          proposedValue: 'Descriere noua',
        },
      ],
    });

    expect(result.created).toBe(true);
    expect(result.changeset.id).toBe(13);
    expect(repository.createChangeset).toHaveBeenCalledTimes(1);
  });
});
