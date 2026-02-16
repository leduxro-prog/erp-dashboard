import { Repository } from 'typeorm';
import {
  JournalEntry,
  JournalEntryStatus,
  ApprovalStatus,
} from '../../domain/entities/JournalEntry';
import { IJournalEntryRepository } from '../../domain/repositories/IJournalEntryRepository';
import { JournalEntryEntity } from '../entities/JournalEntryEntity';
import { ChartOfAccountEntity } from '../entities/ChartOfAccountEntity';

export class JournalEntryRepository implements IJournalEntryRepository {
  constructor(private ormRepository: Repository<JournalEntryEntity>) {}

  async create(entry: JournalEntry): Promise<JournalEntry> {
    const entity = this.ormRepository.create({
      id: entry.id,
      organizationId: entry.organizationId,
      fiscalPeriodId: entry.fiscalPeriodId,
      entryNumber: entry.entryNumber,
      entryDate: entry.entryDate,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      description: entry.description,
      totalDebit: entry.totalDebit,
      totalCredit: entry.totalCredit,
      status: entry.status,
      isPosted: entry.isPosted,
      postedDate: entry.postedDate,
      postedBy: entry.postedBy,
      approvalStatus: entry.approvalStatus,
      approvedBy: entry.approvedBy,
      approvedDate: entry.approvedDate,
      reversalEntryId: entry.reversalEntryId,
      metadata: entry.metadata,
      createdBy: entry.createdBy,
      updatedBy: entry.updatedBy,
      lines: entry.lines.map((line, index) => ({
        id: line.id || `${entry.id}-line-${index}`,
        journalEntryId: entry.id,
        lineNumber: line.lineNumber,
        accountId: line.accountId,
        costCenterId: line.costCenterId,
        taxCodeId: line.taxCodeId,
        description: line.description,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        referenceNumber: line.referenceNumber,
        metadata: line.metadata || {},
      })),
    });

    const saved = await this.ormRepository.save(entity);
    return this.toDomain(saved);
  }

  async update(entry: JournalEntry): Promise<JournalEntry> {
    await this.ormRepository.update(entry.id, {
      entryDate: entry.entryDate,
      description: entry.description,
      totalDebit: entry.totalDebit,
      totalCredit: entry.totalCredit,
      status: entry.status,
      isPosted: entry.isPosted,
      postedDate: entry.postedDate,
      postedBy: entry.postedBy,
      approvalStatus: entry.approvalStatus,
      approvedBy: entry.approvedBy,
      approvedDate: entry.approvedDate,
      reversalEntryId: entry.reversalEntryId,
      metadata: entry.metadata,
      updatedBy: entry.updatedBy,
    });

    const updated = await this.ormRepository.findOne({
      where: { id: entry.id },
      relations: ['lines'],
    });
    if (!updated) throw new Error('Journal entry not found after update');
    return this.toDomain(updated);
  }

  async postEntryAndUpdateBalances(params: {
    entryId: string;
    organizationId: string;
    userId: string;
    postedDate: Date;
    lines: Array<{ accountId: string; debitAmount: number; creditAmount: number }>;
  }): Promise<JournalEntry> {
    const postedEntry = await this.ormRepository.manager.transaction(async (manager) => {
      for (const line of params.lines) {
        const debitAmount = Number(line.debitAmount);
        const creditAmount = Number(line.creditAmount);
        const updateResult = await manager
          .createQueryBuilder()
          .update(ChartOfAccountEntity)
          .set({
            balance: () =>
              `"balance" + CASE WHEN "accountType" IN ('ASSET', 'EXPENSE') THEN ${debitAmount} - ${creditAmount} ELSE ${creditAmount} - ${debitAmount} END`,
            updatedBy: params.userId,
          })
          .where('id = :accountId AND "organizationId" = :organizationId', {
            accountId: line.accountId,
            organizationId: params.organizationId,
          })
          .execute();

        if (!updateResult.affected) {
          throw new Error(`Account ${line.accountId} not found`);
        }
      }

      await manager.update(
        JournalEntryEntity,
        { id: params.entryId, organizationId: params.organizationId },
        {
          status: JournalEntryStatus.POSTED,
          isPosted: true,
          postedDate: params.postedDate,
          postedBy: params.userId,
          updatedBy: params.userId,
        },
      );

      const updated = await manager.getRepository(JournalEntryEntity).findOne({
        where: { id: params.entryId, organizationId: params.organizationId },
        relations: ['lines'],
      });

      if (!updated) {
        throw new Error('Journal entry not found after posting');
      }

      return updated;
    });

    return this.toDomain(postedEntry);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.ormRepository.delete({ id, organizationId });
  }

  async findById(id: string, organizationId: string): Promise<JournalEntry | null> {
    const entity = await this.ormRepository.findOne({
      where: { id, organizationId },
      relations: ['lines'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByNumber(entryNumber: string, organizationId: string): Promise<JournalEntry | null> {
    const entity = await this.ormRepository.findOne({
      where: { entryNumber, organizationId },
      relations: ['lines'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findByFiscalPeriod(
    fiscalPeriodId: string,
    organizationId: string,
  ): Promise<JournalEntry[]> {
    const entities = await this.ormRepository.find({
      where: { fiscalPeriodId, organizationId },
      relations: ['lines'],
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findByStatus(status: JournalEntryStatus, organizationId: string): Promise<JournalEntry[]> {
    const entities = await this.ormRepository.find({
      where: { status, organizationId },
      relations: ['lines'],
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findByApprovalStatus(
    approvalStatus: ApprovalStatus,
    organizationId: string,
  ): Promise<JournalEntry[]> {
    const entities = await this.ormRepository.find({
      where: { approvalStatus, organizationId },
      relations: ['lines'],
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findByAccount(accountId: string, organizationId: string): Promise<JournalEntry[]> {
    const entities = await this.ormRepository
      .createQueryBuilder('je')
      .innerJoinAndSelect('je.lines', 'lines')
      .where('je.organizationId = :orgId', { orgId: organizationId })
      .andWhere('lines.accountId = :accountId', { accountId })
      .getMany();

    return entities.map((e) => this.toDomain(e));
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    organizationId: string,
  ): Promise<JournalEntry[]> {
    const entities = await this.ormRepository.find({
      where: {
        organizationId,
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
      } as any,
      relations: ['lines'],
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findPosted(organizationId: string): Promise<JournalEntry[]> {
    const entities = await this.ormRepository.find({
      where: { organizationId, isPosted: true },
      relations: ['lines'],
    });
    return entities.map((e) => this.toDomain(e));
  }

  async findByReference(
    referenceType: string,
    referenceId: string,
    organizationId: string,
  ): Promise<JournalEntry | null> {
    const entity = await this.ormRepository.findOne({
      where: { organizationId, referenceType, referenceId },
      relations: ['lines'],
    });
    return entity ? this.toDomain(entity) : null;
  }

  async getNextEntryNumber(organizationId: string): Promise<string> {
    const lastEntry = await this.ormRepository
      .createQueryBuilder('je')
      .where('je.organizationId = :orgId', { orgId: organizationId })
      .orderBy('je.createdAt', 'DESC')
      .limit(1)
      .getOne();

    if (!lastEntry) {
      return `${organizationId.substring(0, 4)}-0001`;
    }

    const lastNumber = parseInt(lastEntry.entryNumber.split('-').pop() || '0', 10);
    const nextNumber = String(lastNumber + 1).padStart(4, '0');
    return `${organizationId.substring(0, 4)}-${nextNumber}`;
  }

  private toDomain(entity: JournalEntryEntity): JournalEntry {
    return new JournalEntry({
      id: entity.id,
      organizationId: entity.organizationId,
      fiscalPeriodId: entity.fiscalPeriodId,
      entryNumber: entity.entryNumber,
      entryDate: entity.entryDate,
      referenceType: entity.referenceType,
      referenceId: entity.referenceId,
      description: entity.description,
      totalDebit: parseFloat(entity.totalDebit.toString()),
      totalCredit: parseFloat(entity.totalCredit.toString()),
      status: entity.status as JournalEntryStatus,
      isPosted: entity.isPosted,
      postedDate: entity.postedDate,
      postedBy: entity.postedBy,
      approvalStatus: entity.approvalStatus as ApprovalStatus,
      approvedBy: entity.approvedBy,
      approvedDate: entity.approvedDate,
      reversalEntryId: entity.reversalEntryId,
      lines:
        entity.lines?.map((line) => ({
          id: line.id,
          lineNumber: line.lineNumber,
          accountId: line.accountId,
          costCenterId: line.costCenterId,
          taxCodeId: line.taxCodeId,
          description: line.description,
          debitAmount: parseFloat(line.debitAmount.toString()),
          creditAmount: parseFloat(line.creditAmount.toString()),
          quantity: line.quantity ? parseFloat(line.quantity.toString()) : undefined,
          unitPrice: line.unitPrice ? parseFloat(line.unitPrice.toString()) : undefined,
          referenceNumber: line.referenceNumber,
          metadata: line.metadata,
        })) || [],
      metadata: entity.metadata,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy,
    });
  }
}
