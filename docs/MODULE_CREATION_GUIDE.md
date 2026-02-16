# Module Creation Guide

**Version:** 0.1.0
**Target Audience:** Developers adding new modules to CYPHER ERP
**Last Updated:** February 2025

## Overview

This guide walks you through creating a new module using CYPHER ERP's hexagonal (clean) architecture pattern. Follow these 14 steps to add a fully-featured, testable module.

## Table of Contents

1. [Module Structure Overview](#1-module-structure-overview)
2. [Step 1: Create Module Directory](#step-1-create-module-directory)
3. [Step 2: Define Domain Entities](#step-2-define-domain-entities)
4. [Step 3: Define Repository Ports (Interfaces)](#step-3-define-repository-ports-interfaces)
5. [Step 4: Implement Domain Services](#step-4-implement-domain-services)
6. [Step 5: Create Use-Cases](#step-5-create-use-cases)
7. [Step 6: Define TypeORM Entities](#step-6-define-typeorm-entities)
8. [Step 7: Implement Repositories](#step-7-implement-repositories)
9. [Step 8: Create API Layer (Controllers, Validators, Routes)](#step-8-create-api-layer)
10. [Step 9: Implement Composition Root (Dependency Injection)](#step-9-implement-composition-root-di)
11. [Step 10: Register Events (Publish & Subscribe)](#step-10-register-events)
12. [Step 11: Add Feature Flag](#step-11-add-feature-flag)
13. [Step 12: Write Tests](#step-12-write-tests)
14. [Step 13: Add OpenAPI Documentation](#step-13-add-openapi-documentation)
15. [Step 14: Register in Main Server](#step-14-register-in-main-server)
16. [Module Checklist](#module-checklist)

---

## 1. Module Structure Overview

```
my-new-module/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── MyEntity.ts
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── MyDomainService.ts
│   │   │   └── index.ts
│   │   ├── repositories/
│   │   │   ├── IMyRepository.ts
│   │   │   └── index.ts
│   │   ├── errors/
│   │   │   ├── MyCustomError.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── CreateMyEntity.ts
│   │   │   ├── UpdateMyEntity.ts
│   │   │   ├── DeleteMyEntity.ts
│   │   │   └── index.ts
│   │   ├── dtos/
│   │   │   ├── my-module.dtos.ts
│   │   │   └── index.ts
│   │   ├── ports/
│   │   │   ├── IMyRepository.ts
│   │   │   └── index.ts
│   │   ├── errors/
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── infrastructure/
│   │   ├── entities/
│   │   │   ├── MyEntity.ts
│   │   │   └── index.ts
│   │   ├── repositories/
│   │   │   ├── TypeOrmMyRepository.ts
│   │   │   └── index.ts
│   │   ├── cache/ (optional)
│   │   │   ├── MyCache.ts
│   │   │   └── index.ts
│   │   ├── jobs/ (optional, for BullMQ)
│   │   │   ├── MyJob.ts
│   │   │   └── index.ts
│   │   ├── api/
│   │   │   ├── controllers/
│   │   │   │   ├── MyController.ts
│   │   │   │   └── index.ts
│   │   │   ├── validators/
│   │   │   │   ├── my-module.validators.ts
│   │   │   │   └── index.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts (optional, if needed)
│   │   │   │   └── index.ts
│   │   │   └── routes/
│   │   │       ├── my-module.routes.ts
│   │   │       └── index.ts
│   │   ├── composition-root.ts
│   │   └── index.ts
│   │
│   └── index.ts
│
├── tests/
│   ├── domain/
│   │   ├── MyDomainService.test.ts
│   │   └── MyEntity.test.ts
│   ├── application/
│   │   ├── CreateMyEntity.test.ts
│   │   └── UpdateMyEntity.test.ts
│   └── integration/
│       └── my-module.integration.test.ts
│
├── package.json (if standalone)
└── README.md (module-specific docs)
```

---

## Step 1: Create Module Directory

```bash
# Create the module structure
mkdir -p modules/my-new-module/src/{domain,application,infrastructure}
mkdir -p modules/my-new-module/src/domain/{entities,services,repositories,errors}
mkdir -p modules/my-new-module/src/application/{use-cases,dtos,ports,errors}
mkdir -p modules/my-new-module/src/infrastructure/{entities,repositories,api,jobs}
mkdir -p modules/my-new-module/src/infrastructure/api/{controllers,validators,middleware,routes}
mkdir -p modules/my-new-module/tests/{domain,application,integration}

# Navigate to module
cd modules/my-new-module
```

---

## Step 2: Define Domain Entities

Domain entities represent your core business concepts. They contain **pure business logic** and **no database/framework dependencies**.

### Example: Marketing Campaign Entity

**File:** `modules/marketing/src/domain/entities/Campaign.ts`

```typescript
/**
 * Campaign domain entity.
 * Represents a marketing campaign with scheduling, targeting, and performance metrics.
 * Pure business logic — no database or framework dependencies.
 */
export class Campaign {
  id: number;
  name: string;
  description: string;
  status: CampaignStatus;
  startDate: Date;
  endDate: Date;
  budget: number;
  spent: number;
  targetSegment: string; // 'all', 'tier_1', 'tier_2', etc.

  constructor(
    id: number,
    name: string,
    description: string,
    status: CampaignStatus,
    startDate: Date,
    endDate: Date,
    budget: number,
    spent: number,
    targetSegment: string
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.status = status;
    this.startDate = startDate;
    this.endDate = endDate;
    this.budget = budget;
    this.spent = spent;
    this.targetSegment = targetSegment;
  }

  /**
   * Calculate remaining budget.
   * Pure business logic method (no side effects).
   */
  getRemainingBudget(): number {
    return Math.max(0, this.budget - this.spent);
  }

  /**
   * Check if campaign is active (current time is within start/end dates).
   */
  isActive(currentTime: Date = new Date()): boolean {
    return currentTime >= this.startDate && currentTime <= this.endDate;
  }

  /**
   * Calculate spend rate (percentage of budget spent).
   */
  getSpendRate(): number {
    if (this.budget === 0) return 0;
    return (this.spent / this.budget) * 100;
  }

  /**
   * Check if budget is exhausted.
   */
  isBudgetExhausted(): boolean {
    return this.spent >= this.budget;
  }

  /**
   * Record additional spending.
   * Validates that spending doesn't exceed budget.
   */
  recordSpending(amount: number): void {
    if (amount < 0) {
      throw new Error('Spending amount must be positive');
    }

    if (this.spent + amount > this.budget) {
      throw new Error(`Spending would exceed budget. Remaining: ${this.getRemainingBudget()}`);
    }

    this.spent += amount;
  }

  /**
   * Check if campaign can be started.
   */
  canStart(): boolean {
    return this.status === CampaignStatus.DRAFT;
  }

  /**
   * Check if campaign can be paused.
   */
  canPause(): boolean {
    return this.status === CampaignStatus.ACTIVE;
  }

  /**
   * Check if campaign can be resumed.
   */
  canResume(): boolean {
    return this.status === CampaignStatus.PAUSED;
  }

  /**
   * Check if campaign can be ended.
   */
  canEnd(): boolean {
    return [CampaignStatus.ACTIVE, CampaignStatus.PAUSED].includes(this.status);
  }
}

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}
```

**Key Principles:**
- ✅ No database imports (no @Entity, no Column decorators)
- ✅ Constructor takes all required parameters
- ✅ Pure methods (no side effects, no I/O)
- ✅ Encapsulates business rules (e.g., budget validation)
- ✅ Easy to test

---

## Step 3: Define Repository Ports (Interfaces)

Ports define what data access operations the module needs. Implementations come later.

**File:** `modules/marketing/src/domain/repositories/ICampaignRepository.ts`

```typescript
import { Campaign } from '../entities/Campaign';

/**
 * Campaign Repository Port (Interface).
 * Defines all data access operations needed by the marketing domain.
 * Implementation provided by infrastructure layer (TypeORM).
 */
export interface ICampaignRepository {
  /**
   * Create a new campaign in persistent storage.
   *
   * @param campaign - Campaign entity to persist
   * @returns Persisted campaign with ID
   * @throws Error if creation fails
   */
  create(campaign: Campaign): Promise<Campaign>;

  /**
   * Find campaign by ID.
   *
   * @param id - Campaign ID
   * @returns Campaign if found, null otherwise
   */
  findById(id: number): Promise<Campaign | null>;

  /**
   * Find all campaigns matching criteria.
   *
   * @param filters - Optional filter criteria
   * @returns Array of campaigns
   */
  findAll(filters?: { status?: string; targetSegment?: string }): Promise<Campaign[]>;

  /**
   * Find campaigns by target segment.
   *
   * @param targetSegment - Target segment identifier
   * @returns Array of campaigns for segment
   */
  findBySegment(targetSegment: string): Promise<Campaign[]>;

  /**
   * Find active campaigns (where current time is between start and end dates).
   *
   * @returns Array of active campaigns
   */
  findActive(): Promise<Campaign[]>;

  /**
   * Update existing campaign.
   *
   * @param id - Campaign ID
   * @param updates - Partial campaign data
   * @returns Updated campaign
   * @throws Error if campaign not found or update fails
   */
  update(id: number, updates: Partial<Campaign>): Promise<Campaign>;

  /**
   * Delete campaign by ID.
   *
   * @param id - Campaign ID
   * @returns true if deleted, false if not found
   */
  delete(id: number): Promise<boolean>;

  /**
   * Count total campaigns matching criteria.
   *
   * @param filters - Optional filter criteria
   * @returns Total count
   */
  count(filters?: { status?: string }): Promise<number>;

  /**
   * Record spending for a campaign.
   * Updates the spent amount.
   *
   * @param campaignId - Campaign ID
   * @param amount - Amount spent
   * @throws Error if campaign not found or amount invalid
   */
  recordSpending(campaignId: number, amount: number): Promise<Campaign>;

  /**
   * Update campaign status.
   *
   * @param id - Campaign ID
   * @param status - New status
   * @returns Updated campaign
   */
  updateStatus(id: number, status: string): Promise<Campaign>;
}
```

**Key Principles:**
- ✅ Defines contract (what operations are available)
- ✅ Uses domain entities (Campaign) in signature
- ✅ Returns Promises (async/await ready)
- ✅ No implementation details
- ✅ Easy to mock for testing

---

## Step 4: Implement Domain Services

Domain services contain complex business logic that doesn't fit in a single entity.

**File:** `modules/marketing/src/domain/services/CampaignAnalytics.ts`

```typescript
import { Campaign, CampaignStatus } from '../entities/Campaign';

/**
 * Campaign Analytics Service.
 * Stateless service providing complex business logic for campaign analysis.
 * No I/O or side effects — pure functions.
 */
export class CampaignAnalytics {
  /**
   * Recommend campaigns for pause based on budget spend rate.
   * If spend rate > 80%, recommend pause to avoid overspend.
   *
   * @param campaigns - Array of campaigns to analyze
   * @returns Campaigns recommended for pause with reason
   */
  recommendPauseCandidates(campaigns: Campaign[]): Array<{
    campaign: Campaign;
    reason: string;
    spendRate: number;
  }> {
    return campaigns
      .filter(c => c.status === CampaignStatus.ACTIVE && c.getSpendRate() > 80)
      .map(c => ({
        campaign: c,
        reason: `High spend rate (${c.getSpendRate().toFixed(1)}%) — pause to avoid budget overspend`,
        spendRate: c.getSpendRate()
      }));
  }

  /**
   * Calculate average ROI across campaigns.
   *
   * @param campaigns - Campaigns to analyze
   * @returns Object with ROI metrics
   */
  calculateAggregateMetrics(campaigns: Campaign[]): {
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
    averageSpendRate: number;
    activeCampaignsCount: number;
  } {
    if (campaigns.length === 0) {
      return {
        totalBudget: 0,
        totalSpent: 0,
        totalRemaining: 0,
        averageSpendRate: 0,
        activeCampaignsCount: 0
      };
    }

    const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);
    const totalSpent = campaigns.reduce((sum, c) => sum + c.spent, 0);
    const activeCampaignsCount = campaigns.filter(c => c.isActive()).length;

    return {
      totalBudget,
      totalSpent,
      totalRemaining: totalBudget - totalSpent,
      averageSpendRate: (totalSpent / totalBudget) * 100,
      activeCampaignsCount
    };
  }

  /**
   * Segment campaigns by performance.
   *
   * @param campaigns - Campaigns to segment
   * @returns Campaigns grouped by performance tier
   */
  segmentByPerformance(campaigns: Campaign[]): {
    wellFunded: Campaign[];      // Spend rate < 50%
    onTrack: Campaign[];         // Spend rate 50-80%
    atRisk: Campaign[];          // Spend rate > 80%
    completed: Campaign[];       // Status ENDED
  } {
    return {
      wellFunded: campaigns.filter(c => c.getSpendRate() < 50),
      onTrack: campaigns.filter(c => c.getSpendRate() >= 50 && c.getSpendRate() <= 80),
      atRisk: campaigns.filter(c => c.getSpendRate() > 80),
      completed: campaigns.filter(c => c.status === CampaignStatus.ENDED)
    };
  }
}
```

---

## Step 5: Create Use-Cases

Use-cases orchestrate interactions between entities, repositories, and services.

**File:** `modules/marketing/src/application/use-cases/CreateCampaign.ts`

```typescript
import { Campaign, CampaignStatus } from '../../domain/entities/Campaign';
import { ICampaignRepository } from '../../domain/repositories/ICampaignRepository';
import { CreateCampaignRequest, CreateCampaignResponse } from '../dtos/marketing.dtos';

/**
 * CreateCampaign Use-Case.
 * Orchestrates campaign creation with validation and persistence.
 *
 * Responsibilities:
 * - Validate input (DTO/request schema)
 * - Create domain entity
 * - Call repository to persist
 * - Return response DTO
 *
 * Dependencies:
 * - ICampaignRepository (injected)
 */
export class CreateCampaign {
  constructor(private campaignRepository: ICampaignRepository) {}

  /**
   * Execute the CreateCampaign use-case.
   *
   * @param request - CreateCampaignRequest DTO
   * @returns Promise<CreateCampaignResponse>
   * @throws ValidationError if input is invalid
   * @throws Error if persistence fails
   */
  async execute(request: CreateCampaignRequest): Promise<CreateCampaignResponse> {
    // Step 1: Validate input
    this.validateRequest(request);

    // Step 2: Create domain entity
    const campaign = new Campaign(
      0, // ID will be assigned by database
      request.name,
      request.description,
      CampaignStatus.DRAFT,
      request.startDate,
      request.endDate,
      request.budget,
      0, // Initial spent = 0
      request.targetSegment
    );

    // Step 3: Persist via repository
    const createdCampaign = await this.campaignRepository.create(campaign);

    // Step 4: Return response DTO
    return {
      id: createdCampaign.id,
      name: createdCampaign.name,
      status: createdCampaign.status,
      budget: createdCampaign.budget,
      spent: createdCampaign.spent,
      message: 'Campaign created successfully'
    };
  }

  /**
   * Validate request parameters.
   * Throws validation error if invalid.
   */
  private validateRequest(request: CreateCampaignRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Campaign name is required');
    }

    if (request.budget <= 0) {
      throw new Error('Campaign budget must be greater than 0');
    }

    if (request.endDate <= request.startDate) {
      throw new Error('End date must be after start date');
    }

    const validSegments = ['all', 'tier_1', 'tier_2', 'tier_3'];
    if (!validSegments.includes(request.targetSegment)) {
      throw new Error(`Invalid target segment. Must be one of: ${validSegments.join(', ')}`);
    }
  }
}
```

**File:** `modules/marketing/src/application/use-cases/index.ts`

```typescript
export { CreateCampaign } from './CreateCampaign';
export { UpdateCampaign } from './UpdateCampaign';
export { DeleteCampaign } from './DeleteCampaign';
export { GetCampaignDetails } from './GetCampaignDetails';
export { ListCampaigns } from './ListCampaigns';
// Add more use-cases as needed
```

**Key Principles:**
- ✅ Each use-case = one business operation
- ✅ Dependencies injected (not hardcoded)
- ✅ Validation before domain logic
- ✅ Returns DTO (not domain entity)
- ✅ Throws typed errors
- ✅ No Express/HTTP specifics

---

## Step 6: Define TypeORM Entities

TypeORM entities map domain entities to database tables.

**File:** `modules/marketing/src/infrastructure/entities/CampaignEntity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

/**
 * Campaign TypeORM Entity.
 * Maps Campaign domain entity to PostgreSQL table.
 * Includes database-specific concerns (columns, indexes, constraints).
 */
@Entity('campaigns')
@Index('idx_campaigns_status', ['status'])
@Index('idx_campaigns_target_segment', ['targetSegment'])
@Index('idx_campaigns_created_at', ['createdAt'])
export class CampaignEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('text')
  description: string;

  @Column('varchar', { length: 50, default: 'draft' })
  status: string;

  @Column('timestamp')
  startDate: Date;

  @Column('timestamp')
  endDate: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  budget: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  spent: number;

  @Column('varchar', { length: 50 })
  targetSegment: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Convert TypeORM entity to domain entity.
   *
   * @returns Campaign domain entity
   */
  toDomain(): Campaign {
    const { Campaign, CampaignStatus } = require('../../domain/entities/Campaign');
    return new Campaign(
      this.id,
      this.name,
      this.description,
      this.status as CampaignStatus,
      this.startDate,
      this.endDate,
      Number(this.budget),
      Number(this.spent),
      this.targetSegment
    );
  }

  /**
   * Create TypeORM entity from domain entity.
   *
   * @param campaign - Campaign domain entity
   * @returns CampaignEntity
   */
  static fromDomain(campaign: Campaign): CampaignEntity {
    const entity = new CampaignEntity();
    entity.id = campaign.id;
    entity.name = campaign.name;
    entity.description = campaign.description;
    entity.status = campaign.status;
    entity.startDate = campaign.startDate;
    entity.endDate = campaign.endDate;
    entity.budget = campaign.budget;
    entity.spent = campaign.spent;
    entity.targetSegment = campaign.targetSegment;
    return entity;
  }
}
```

---

## Step 7: Implement Repositories

Repositories implement the port interface using TypeORM.

**File:** `modules/marketing/src/infrastructure/repositories/TypeOrmCampaignRepository.ts`

```typescript
import { DataSource, Repository } from 'typeorm';
import { Campaign, CampaignStatus } from '../../domain/entities/Campaign';
import { ICampaignRepository } from '../../domain/repositories/ICampaignRepository';
import { CampaignEntity } from '../entities/CampaignEntity';

/**
 * Campaign Repository Implementation (TypeORM).
 * Implements ICampaignRepository using TypeORM and PostgreSQL.
 * Converts between domain entities and TypeORM entities.
 */
export class TypeOrmCampaignRepository implements ICampaignRepository {
  private repository: Repository<CampaignEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(CampaignEntity);
  }

  async create(campaign: Campaign): Promise<Campaign> {
    const entity = CampaignEntity.fromDomain(campaign);
    const saved = await this.repository.save(entity);
    return saved.toDomain();
  }

  async findById(id: number): Promise<Campaign | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? entity.toDomain() : null;
  }

  async findAll(filters?: { status?: string; targetSegment?: string }): Promise<Campaign[]> {
    let query = this.repository.createQueryBuilder('campaign');

    if (filters?.status) {
      query = query.where('campaign.status = :status', { status: filters.status });
    }

    if (filters?.targetSegment) {
      query = query.andWhere('campaign.targetSegment = :segment', {
        segment: filters.targetSegment
      });
    }

    const entities = await query.orderBy('campaign.createdAt', 'DESC').getMany();
    return entities.map(e => e.toDomain());
  }

  async findBySegment(targetSegment: string): Promise<Campaign[]> {
    const entities = await this.repository.find({
      where: { targetSegment },
      order: { createdAt: 'DESC' }
    });
    return entities.map(e => e.toDomain());
  }

  async findActive(): Promise<Campaign[]> {
    const now = new Date();
    const entities = await this.repository
      .createQueryBuilder('campaign')
      .where('campaign.status = :status', { status: CampaignStatus.ACTIVE })
      .andWhere('campaign.startDate <= :now', { now })
      .andWhere('campaign.endDate >= :now', { now })
      .orderBy('campaign.endDate', 'ASC')
      .getMany();

    return entities.map(e => e.toDomain());
  }

  async update(id: number, updates: Partial<Campaign>): Promise<Campaign> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new Error(`Campaign with ID ${id} not found`);
    }

    // Merge updates
    Object.assign(entity, updates);
    const saved = await this.repository.save(entity);
    return saved.toDomain();
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected! > 0;
  }

  async count(filters?: { status?: string }): Promise<number> {
    let query = this.repository.createQueryBuilder('campaign');

    if (filters?.status) {
      query = query.where('campaign.status = :status', { status: filters.status });
    }

    return query.getCount();
  }

  async recordSpending(campaignId: number, amount: number): Promise<Campaign> {
    const entity = await this.repository.findOne({ where: { id: campaignId } });
    if (!entity) {
      throw new Error(`Campaign with ID ${campaignId} not found`);
    }

    const campaign = entity.toDomain();
    campaign.recordSpending(amount); // Domain validation

    entity.spent = campaign.spent;
    const saved = await this.repository.save(entity);
    return saved.toDomain();
  }

  async updateStatus(id: number, status: string): Promise<Campaign> {
    return this.update(id, { status: status as CampaignStatus });
  }
}
```

---

## Step 8: Create API Layer (Controllers, Validators, Routes)

### 8.1 DTOs (Data Transfer Objects)

**File:** `modules/marketing/src/application/dtos/marketing.dtos.ts`

```typescript
/**
 * Campaign Creation Request DTO.
 * Received from client, validated before reaching domain layer.
 */
export interface CreateCampaignRequest {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  budget: number;
  targetSegment: 'all' | 'tier_1' | 'tier_2' | 'tier_3';
}

/**
 * Campaign Creation Response DTO.
 * Returned to client after successful creation.
 */
export interface CreateCampaignResponse {
  id: number;
  name: string;
  status: string;
  budget: number;
  spent: number;
  message: string;
}

/**
 * Campaign List Response DTO.
 */
export interface CampaignListResponse {
  campaigns: {
    id: number;
    name: string;
    status: string;
    budget: number;
    spent: number;
    spendRate: number;
    targetSegment: string;
    createdAt: Date;
  }[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Campaign Details Response DTO.
 */
export interface CampaignDetailsResponse {
  id: number;
  name: string;
  description: string;
  status: string;
  startDate: Date;
  endDate: Date;
  budget: number;
  spent: number;
  remainingBudget: number;
  spendRate: number;
  targetSegment: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 8.2 Validators

**File:** `modules/marketing/src/infrastructure/api/validators/marketing.validators.ts`

```typescript
import Joi from 'joi';

/**
 * Campaign creation validation schema.
 */
export const createCampaignSchema = Joi.object({
  name: Joi.string().min(3).max(255).required(),
  description: Joi.string().max(2000).optional(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  budget: Joi.number().positive().required(),
  targetSegment: Joi.string().valid('all', 'tier_1', 'tier_2', 'tier_3').required()
});

/**
 * Campaign update validation schema.
 */
export const updateCampaignSchema = Joi.object({
  name: Joi.string().min(3).max(255).optional(),
  description: Joi.string().max(2000).optional(),
  budget: Joi.number().positive().optional(),
  status: Joi.string().valid('draft', 'active', 'paused', 'ended', 'cancelled').optional()
});

/**
 * Campaign list query validation schema.
 */
export const listCampaignsSchema = Joi.object({
  status: Joi.string().valid('draft', 'active', 'paused', 'ended', 'cancelled').optional(),
  targetSegment: Joi.string().optional(),
  page: Joi.number().min(1).default(1).optional(),
  pageSize: Joi.number().min(1).max(100).default(20).optional()
});

/**
 * Validation middleware factory.
 */
export function validationMiddleware(schema: Joi.Schema, dataSource: 'body' | 'query' = 'body') {
  return (req: any, res: any, next: any) => {
    const data = dataSource === 'body' ? req.body : req.query;
    const { error, value } = schema.validate(data, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => ({ field: d.path[0], message: d.message }))
      });
    }

    req[dataSource] = value;
    next();
  };
}
```

### 8.3 Controllers

**File:** `modules/marketing/src/infrastructure/api/controllers/MarketingController.ts`

```typescript
import { Request, Response } from 'express';
import { CreateCampaign } from '../../../application/use-cases/CreateCampaign';
import { UpdateCampaign } from '../../../application/use-cases/UpdateCampaign';
import { GetCampaignDetails } from '../../../application/use-cases/GetCampaignDetails';
import { ListCampaigns } from '../../../application/use-cases/ListCampaigns';
import { DeleteCampaign } from '../../../application/use-cases/DeleteCampaign';

/**
 * Marketing Controller.
 * Handles HTTP requests and delegates to use-cases.
 * Responsibilities:
 * - Extract request data
 * - Call use-cases
 * - Format HTTP responses
 * - Handle errors
 */
export class MarketingController {
  constructor(
    private createCampaign: CreateCampaign,
    private updateCampaign: UpdateCampaign,
    private getCampaignDetails: GetCampaignDetails,
    private listCampaigns: ListCampaigns,
    private deleteCampaign: DeleteCampaign
  ) {}

  async createCampaignHandler(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.createCampaign.execute(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateCampaignHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.updateCampaign.execute(Number(id), req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getCampaignDetailsHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.getCampaignDetails.execute(Number(id));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
  }

  async listCampaignsHandler(req: Request, res: Response): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 20;
      const result = await this.listCampaigns.execute({
        status: req.query.status as string | undefined,
        targetSegment: req.query.targetSegment as string | undefined,
        page,
        pageSize
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async deleteCampaignHandler(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.deleteCampaign.execute(Number(id));
      res.status(204).send();
    } catch (error) {
      res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
  }
}
```

### 8.4 Routes

**File:** `modules/marketing/src/infrastructure/api/routes/marketing.routes.ts`

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { MarketingController } from '../controllers/MarketingController';
import {
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsSchema,
  validationMiddleware
} from '../validators/marketing.validators';

export function createMarketingRoutes(controller: MarketingController): Router {
  const router = Router();

  // Create campaign
  router.post(
    '/campaigns',
    validationMiddleware(createCampaignSchema, 'body'),
    (req: Request, res: Response) => controller.createCampaignHandler(req, res)
  );

  // List campaigns
  router.get(
    '/campaigns',
    validationMiddleware(listCampaignsSchema, 'query'),
    (req: Request, res: Response) => controller.listCampaignsHandler(req, res)
  );

  // Get campaign details
  router.get(
    '/campaigns/:id',
    (req: Request, res: Response) => controller.getCampaignDetailsHandler(req, res)
  );

  // Update campaign
  router.patch(
    '/campaigns/:id',
    validationMiddleware(updateCampaignSchema, 'body'),
    (req: Request, res: Response) => controller.updateCampaignHandler(req, res)
  );

  // Delete campaign
  router.delete(
    '/campaigns/:id',
    (req: Request, res: Response) => controller.deleteCampaignHandler(req, res)
  );

  return router;
}
```

---

## Step 9: Implement Composition Root (Dependency Injection)

The composition root wires up all dependencies and returns a configured router.

**File:** `modules/marketing/src/infrastructure/composition-root.ts`

```typescript
import { DataSource } from 'typeorm';
import { Router } from 'express';

// Domain
import { CampaignAnalytics } from '../domain/services/CampaignAnalytics';

// Application
import { CreateCampaign } from '../application/use-cases/CreateCampaign';
import { UpdateCampaign } from '../application/use-cases/UpdateCampaign';
import { GetCampaignDetails } from '../application/use-cases/GetCampaignDetails';
import { ListCampaigns } from '../application/use-cases/ListCampaigns';
import { DeleteCampaign } from '../application/use-cases/DeleteCampaign';

// Infrastructure
import { TypeOrmCampaignRepository } from './repositories/TypeOrmCampaignRepository';
import { MarketingController } from './api/controllers/MarketingController';
import { createMarketingRoutes } from './api/routes/marketing.routes';

/**
 * Marketing Module Composition Root (Dependency Injection).
 *
 * Wires up all dependencies in the correct order:
 * 1. Repositories (data access layer)
 * 2. Domain services (business logic)
 * 3. Use-cases (orchestration)
 * 4. Controllers (HTTP layer)
 * 5. Routes (Express router)
 *
 * @param dataSource - TypeORM DataSource
 * @returns Configured Express router
 */
export function createMarketingRouter(dataSource: DataSource): Router {
  // Step 1: Instantiate repositories
  const campaignRepository = new TypeOrmCampaignRepository(dataSource);

  // Step 2: Instantiate domain services
  const campaignAnalytics = new CampaignAnalytics();

  // Step 3: Instantiate use-cases with dependencies
  const createCampaign = new CreateCampaign(campaignRepository);
  const updateCampaign = new UpdateCampaign(campaignRepository);
  const getCampaignDetails = new GetCampaignDetails(campaignRepository);
  const listCampaigns = new ListCampaigns(campaignRepository);
  const deleteCampaign = new DeleteCampaign(campaignRepository);

  // Step 4: Instantiate controller with use-cases
  const controller = new MarketingController(
    createCampaign,
    updateCampaign,
    getCampaignDetails,
    listCampaigns,
    deleteCampaign
  );

  // Step 5: Create and return configured router
  return createMarketingRoutes(controller);
}
```

---

## Step 10: Register Events (Publish & Subscribe)

If your module publishes or subscribes to events, register them here.

**File:** `modules/marketing/src/infrastructure/event-handlers.ts`

```typescript
import { getEventBus } from '../../../shared/utils/event-bus';
import { Campaign } from '../domain/entities/Campaign';
import { ICampaignRepository } from '../domain/repositories/ICampaignRepository';

/**
 * Register marketing module event subscribers.
 * Called during application bootstrap.
 *
 * @param campaignRepository - Campaign repository
 */
export async function registerMarketingEventHandlers(
  campaignRepository: ICampaignRepository
): Promise<void> {
  const eventBus = getEventBus();

  // Subscribe to order.created event to track spending
  await eventBus.subscribe('order.created', async (event: any) => {
    try {
      // If order matches active campaigns, record spending
      const activeCampaigns = await campaignRepository.findActive();

      for (const campaign of activeCampaigns) {
        // If customer target segment matches, record spending
        if (campaign.targetSegment === 'all' || campaign.targetSegment === event.customerSegment) {
          await campaignRepository.recordSpending(campaign.id, event.totalPrice);

          // Publish campaign spending event if budget nearly exhausted
          if (campaign.isBudgetExhausted()) {
            await eventBus.publish('campaign.budget_exhausted', {
              campaignId: campaign.id,
              campaignName: campaign.name,
              timestamp: new Date()
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing order.created event:', error);
    }
  });

  console.log('Marketing module event handlers registered');
}
```

**Events Published by Marketing Module:**
- `campaign.created` - Campaign was created
- `campaign.started` - Campaign started (moved to ACTIVE)
- `campaign.budget_exhausted` - Campaign spent entire budget
- `campaign.updated` - Campaign was updated

---

## Step 11: Add Feature Flag

Allow runtime control of the module via feature flags.

**File:** `modules/marketing/src/infrastructure/feature-flag.ts`

```typescript
import { FeatureFlagService } from '../../../shared/utils/feature-flags';

/**
 * Initialize feature flags for marketing module.
 * Called during application bootstrap.
 */
export function initializeMarketingFeatureFlags(): void {
  const flagService = FeatureFlagService.getInstance();

  flagService.registerFlag({
    name: 'MARKETING_CAMPAIGNS_ENABLED',
    enabled: true,
    description: 'Enable marketing campaigns module',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  flagService.registerFlag({
    name: 'MARKETING_BUDGET_ALERTS',
    enabled: true,
    description: 'Enable budget exhaustion alerts',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  flagService.registerFlag({
    name: 'MARKETING_AUTO_PAUSE_HIGH_SPEND',
    enabled: false,
    description: 'Automatically pause campaigns with spend rate > 80%',
    percentage: 0, // Disabled for all users
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

/**
 * Check if marketing module is enabled.
 */
export function isMarketingEnabled(): boolean {
  const flagService = FeatureFlagService.getInstance();
  return flagService.isEnabled('MARKETING_CAMPAIGNS_ENABLED');
}

/**
 * Check if budget alerts are enabled.
 */
export function isBudgetAlertsEnabled(): boolean {
  const flagService = FeatureFlagService.getInstance();
  return flagService.isEnabled('MARKETING_BUDGET_ALERTS');
}
```

---

## Step 12: Write Tests

### 12.1 Domain Entity Tests

**File:** `modules/marketing/tests/domain/Campaign.test.ts`

```typescript
import { Campaign, CampaignStatus } from '../../src/domain/entities/Campaign';

describe('Campaign Domain Entity', () => {
  let campaign: Campaign;

  beforeEach(() => {
    campaign = new Campaign(
      1,
      'Summer Sale 2025',
      'Summer promotional campaign',
      CampaignStatus.DRAFT,
      new Date('2025-06-01'),
      new Date('2025-08-31'),
      10000,
      0,
      'all'
    );
  });

  describe('getRemainingBudget', () => {
    it('should return full budget when no spending', () => {
      expect(campaign.getRemainingBudget()).toBe(10000);
    });

    it('should return correct remaining budget after spending', () => {
      campaign.spent = 2500;
      expect(campaign.getRemainingBudget()).toBe(7500);
    });

    it('should return 0 when budget exhausted', () => {
      campaign.spent = 10000;
      expect(campaign.getRemainingBudget()).toBe(0);
    });
  });

  describe('recordSpending', () => {
    it('should record spending', () => {
      campaign.recordSpending(1000);
      expect(campaign.spent).toBe(1000);
    });

    it('should throw error on negative spending', () => {
      expect(() => campaign.recordSpending(-100)).toThrow();
    });

    it('should throw error when exceeding budget', () => {
      campaign.spent = 9500;
      expect(() => campaign.recordSpending(1000)).toThrow();
    });
  });

  describe('isActive', () => {
    it('should return true if current time within dates', () => {
      const mid = new Date('2025-07-15');
      expect(campaign.isActive(mid)).toBe(true);
    });

    it('should return false if before start date', () => {
      const before = new Date('2025-05-01');
      expect(campaign.isActive(before)).toBe(false);
    });

    it('should return false if after end date', () => {
      const after = new Date('2025-09-01');
      expect(campaign.isActive(after)).toBe(false);
    });
  });

  describe('getSpendRate', () => {
    it('should return 0% with no spending', () => {
      expect(campaign.getSpendRate()).toBe(0);
    });

    it('should return correct percentage', () => {
      campaign.spent = 2500;
      expect(campaign.getSpendRate()).toBe(25);
    });

    it('should return 100% when fully spent', () => {
      campaign.spent = 10000;
      expect(campaign.getSpendRate()).toBe(100);
    });
  });
});
```

### 12.2 Use-Case Tests

**File:** `modules/marketing/tests/application/CreateCampaign.test.ts`

```typescript
import { CreateCampaign } from '../../src/application/use-cases/CreateCampaign';
import { Campaign, CampaignStatus } from '../../src/domain/entities/Campaign';
import { ICampaignRepository } from '../../src/domain/repositories/ICampaignRepository';

// Mock repository
class MockCampaignRepository implements ICampaignRepository {
  campaigns: Campaign[] = [];

  async create(campaign: Campaign): Promise<Campaign> {
    campaign.id = this.campaigns.length + 1;
    this.campaigns.push(campaign);
    return campaign;
  }

  async findById(id: number): Promise<Campaign | null> {
    return this.campaigns.find(c => c.id === id) || null;
  }

  // ... implement other methods as needed for testing
  async findAll() { return this.campaigns; }
  async findBySegment() { return []; }
  async findActive() { return []; }
  async update() { throw new Error('Not implemented'); }
  async delete() { return false; }
  async count() { return 0; }
  async recordSpending() { throw new Error('Not implemented'); }
  async updateStatus() { throw new Error('Not implemented'); }
}

describe('CreateCampaign Use-Case', () => {
  let useCase: CreateCampaign;
  let repository: MockCampaignRepository;

  beforeEach(() => {
    repository = new MockCampaignRepository();
    useCase = new CreateCampaign(repository);
  });

  it('should create campaign successfully', async () => {
    const request = {
      name: 'Test Campaign',
      description: 'Test description',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-30'),
      budget: 5000,
      targetSegment: 'tier_1' as const
    };

    const result = await useCase.execute(request);

    expect(result.name).toBe('Test Campaign');
    expect(result.budget).toBe(5000);
    expect(result.status).toBe(CampaignStatus.DRAFT);
    expect(result.id).toBeDefined();
  });

  it('should throw validation error on invalid budget', async () => {
    const request = {
      name: 'Test Campaign',
      description: '',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-30'),
      budget: -1000, // Invalid
      targetSegment: 'all' as const
    };

    await expect(useCase.execute(request)).rejects.toThrow('Campaign budget must be greater than 0');
  });
});
```

---

## Step 13: Add OpenAPI Documentation

**File:** `src/api-docs/schemas/marketing.schema.ts`

```typescript
export const marketingSchemas = {
  Campaign: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      description: { type: 'string' },
      status: {
        type: 'string',
        enum: ['draft', 'active', 'paused', 'ended', 'cancelled']
      },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      budget: { type: 'number' },
      spent: { type: 'number' },
      targetSegment: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  },
  CreateCampaignRequest: {
    type: 'object',
    required: ['name', 'startDate', 'endDate', 'budget', 'targetSegment'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      budget: { type: 'number' },
      targetSegment: { type: 'string', enum: ['all', 'tier_1', 'tier_2', 'tier_3'] }
    }
  }
};

export const marketingEndpoints = {
  '/api/v1/marketing/campaigns': {
    post: {
      summary: 'Create campaign',
      requestBody: { $ref: '#/components/schemas/CreateCampaignRequest' },
      responses: {
        '201': { description: 'Campaign created' },
        '400': { description: 'Validation error' }
      }
    },
    get: {
      summary: 'List campaigns',
      responses: {
        '200': { description: 'List of campaigns' }
      }
    }
  },
  '/api/v1/marketing/campaigns/{id}': {
    get: {
      summary: 'Get campaign details',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: {
        '200': { description: 'Campaign details' },
        '404': { description: 'Campaign not found' }
      }
    }
  }
};
```

---

## Step 14: Register in Main Server

**File:** `src/server.ts` (add to bootstrap function)

```typescript
import { createMarketingRouter } from '../modules/marketing/src/infrastructure/composition-root';
import { registerMarketingEventHandlers } from '../modules/marketing/src/infrastructure/event-handlers';
import { initializeMarketingFeatureFlags } from '../modules/marketing/src/infrastructure/feature-flag';

async function bootstrap(): Promise<void> {
  // ... existing code ...

  try {
    bootstrapLogger.info('Registering marketing module...');
    initializeMarketingFeatureFlags();
    const marketingRouter = createMarketingRouter(AppDataSource);
    app.use(`${apiPrefix}/marketing`, marketingRouter);
    await registerMarketingEventHandlers(...); // Pass necessary dependencies
    bootstrapLogger.info('Marketing module registered');
  } catch (error) {
    bootstrapLogger.warn('Failed to mount marketing module', { error });
  }

  // ... rest of bootstrap ...
}
```

---

## Module Checklist

Use this checklist when creating a new module:

### Domain Layer
- [ ] Create domain entity class (pure business logic)
- [ ] Create repository port interface (ICampaignRepository)
- [ ] Create domain services (optional, for complex logic)
- [ ] Create domain error classes
- [ ] Write domain unit tests

### Application Layer
- [ ] Create use-case classes (one per operation)
- [ ] Create DTOs (request/response data structures)
- [ ] Create application port interfaces (same as domain for now)
- [ ] Create application error classes
- [ ] Write use-case tests

### Infrastructure Layer
- [ ] Create TypeORM entity class
- [ ] Create repository implementation (TypeOrmCampaignRepository)
- [ ] Create controllers (HTTP request handlers)
- [ ] Create Joi validators
- [ ] Create routes (Express router)
- [ ] Create composition root (DI factory)
- [ ] Write integration tests

### Integration
- [ ] Create event handlers (if module publishes/subscribes)
- [ ] Create feature flags
- [ ] Add OpenAPI documentation
- [ ] Register in main server (src/server.ts)
- [ ] Add TypeORM entities to data-source.ts
- [ ] Create database migration if new tables added

### Testing
- [ ] Unit tests for entities (min 80% coverage)
- [ ] Unit tests for use-cases (min 80% coverage)
- [ ] Integration tests for repositories
- [ ] API endpoint tests (optional, via Supertest)

### Documentation
- [ ] README in module directory
- [ ] JSDoc comments on public methods
- [ ] API endpoint documentation
- [ ] Database schema documentation

---

## Reference Example: Pricing Engine Module

For a real-world example, see `/modules/pricing-engine/`:
- **Domain:** Pricing calculations, tier discounts, volume discounts
- **Entities:** Price, Promotion, VolumeDiscount, CustomerTier
- **Services:** PriceCalculator (pricing formulas)
- **Use-Cases:** CalculatePrice, ManageTiers, ManagePromotions
- **Tests:** 35+ unit tests, 3 integration tests
- **API:** 6 endpoints with Joi validation

---

## FAQ

**Q: Where do I put business logic - domain entity or service?**
A: If logic applies to a single entity, put it in the entity method. If logic coordinates multiple entities/repositories, use a domain service (stateless).

**Q: Do I need both domain and application port interfaces?**
A: For now, they're the same. In future, you might have multiple application layers with different ports.

**Q: How do I handle cross-module dependencies?**
A: Via EventBus pub/sub for async communication. For sync calls, inject repository/service via DI.

**Q: Should I test domain services?**
A: Yes, with unit tests. Mock nothing - test pure logic with various inputs.

**Q: How do I cache repository results?**
A: In the repository implementation layer, before database queries. See /modules/pricing-engine/src/infrastructure/cache/PriceCache.ts.

---

**Last Updated:** February 2025
**Questions?** Ask the development team.
