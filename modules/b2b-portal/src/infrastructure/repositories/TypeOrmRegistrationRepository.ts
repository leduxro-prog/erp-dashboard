import { DataSource, Repository } from 'typeorm';
import { B2BRegistration, B2BRegistrationStatus } from '../../domain/entities/B2BRegistration';
import { IRegistrationRepository, PaginationParams, PaginatedResult, RegistrationFilters } from '../../domain/repositories/IRegistrationRepository';
import { B2BRegistrationEntity } from '../entities/B2BRegistrationEntity';

/**
 * TypeORM Implementation of B2B Registration Repository
 */
export class TypeOrmRegistrationRepository implements IRegistrationRepository {
  private repository: Repository<B2BRegistrationEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(B2BRegistrationEntity);
  }

  async save(registration: B2BRegistration): Promise<B2BRegistration> {
    const entity = new B2BRegistrationEntity();
    // Don't set entity.id - let database auto-generate it
    if (registration.id) {
      entity.id = registration.id;
    }
    entity.companyName = registration.companyName;
    entity.cui = registration.cui;
    entity.regCom = registration.regCom;
    entity.legalAddress = registration.legalAddress;
    entity.deliveryAddress = registration.deliveryAddress;
    entity.contactPerson = registration.contactPerson;
    entity.email = registration.email;
    entity.phone = registration.phone;
    entity.bankName = registration.bankName;
    entity.iban = registration.iban;
    entity.requestedTier = registration.requestedTier;
    entity.paymentTermsDays = registration.paymentTermsDays;
    entity.notes = registration.notes;
    entity.status = registration.status;
    entity.submittedAt = new Date();
    entity.createdAt = registration.createdAt;
    entity.updatedAt = new Date();

    const saved = await this.repository.save(entity);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<B2BRegistration | undefined> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : undefined;
  }

  async findByEmail(email: string): Promise<B2BRegistration | undefined> {
    const entity = await this.repository.findOne({ where: { email } });
    return entity ? this.toDomain(entity) : undefined;
  }

  async findByCui(cui: string): Promise<B2BRegistration | undefined> {
    const entity = await this.repository.findOne({ where: { cui } });
    return entity ? this.toDomain(entity) : undefined;
  }

  async findPending(pagination: PaginationParams): Promise<PaginatedResult<B2BRegistration>> {
    const [entities, total] = await this.repository.findAndCount({
      where: { status: 'PENDING' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: entities.map(e => this.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async findAll(
    filters?: RegistrationFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<B2BRegistration>> {
    let query = this.repository.createQueryBuilder('reg');

    if (filters?.status) {
      query = query.where('reg.status = :status', { status: filters.status });
    }

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      query = query.andWhere(
        '(reg.companyName ILIKE :search OR reg.email ILIKE :search OR reg.cui ILIKE :search)',
        { search: searchTerm }
      );
    }

    if (filters?.createdFromDate) {
      query = query.andWhere('reg.createdAt >= :fromDate', { fromDate: filters.createdFromDate });
    }

    if (filters?.createdToDate) {
      query = query.andWhere('reg.createdAt <= :toDate', { toDate: filters.createdToDate });
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const [entities, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('reg.createdAt', 'DESC')
      .getManyAndCount();

    return {
      items: entities.map(e => this.toDomain(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateStatus(id: string, status: B2BRegistrationStatus): Promise<B2BRegistration> {
    await this.repository.update({ id }, { status: status as any, updatedAt: new Date() });
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new Error(`Registration with ID ${id} not found`);
    }
    return this.toDomain(entity);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async countByStatus(status: B2BRegistrationStatus): Promise<number> {
    return this.repository.countBy({ status: status as any });
  }

  private toDomain(entity: B2BRegistrationEntity): B2BRegistration {
    return new B2BRegistration(
      entity.id!,
      entity.companyName,
      entity.cui || '',
      entity.regCom || '',
      entity.legalAddress || '',
      entity.deliveryAddress || '',
      entity.contactPerson || '',
      entity.email,
      entity.phone || '',
      entity.bankName || '',
      entity.iban || '',
      entity.requestedTier || 'STANDARD',
      entity.paymentTermsDays || 0,
      entity.notes || ''
    );
  }
}
