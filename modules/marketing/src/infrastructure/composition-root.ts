import { DataSource } from 'typeorm';
import { Logger } from 'winston';
import { IEventBus } from '@shared/module-system/module.interface';

import { ICampaignRepository } from '../domain/repositories/ICampaignRepository';
import { IDiscountCodeRepository } from '../domain/repositories/IDiscountCodeRepository';
import { ISequenceRepository } from '../domain/repositories/ISequenceRepository';
import { IMarketingEventRepository } from '../domain/repositories/IMarketingEventRepository';
import { ICampaignStepRepository } from '../domain/repositories/ICampaignStepRepository';
import { IAudienceSegmentRepository } from '../domain/repositories/IAudienceSegmentRepository';
import { IChannelDeliveryRepository } from '../domain/repositories/IChannelDeliveryRepository';
import { ICustomerConsentRepository } from '../domain/repositories/ICustomerConsentRepository';
import { IAttributionEventRepository } from '../domain/repositories/IAttributionEventRepository';
import { ICampaignAuditLogRepository } from '../domain/repositories/ICampaignAuditLogRepository';

import { TypeOrmCampaignRepository } from './repositories/TypeOrmCampaignRepository';
import { TypeOrmDiscountCodeRepository } from './repositories/TypeOrmDiscountCodeRepository';
import { TypeOrmMarketingEventRepository } from './repositories/TypeOrmMarketingEventRepository';
import { TypeOrmCampaignStepRepository } from './repositories/TypeOrmCampaignStepRepository';
import { TypeOrmAudienceSegmentRepository } from './repositories/TypeOrmAudienceSegmentRepository';
import { TypeOrmChannelDeliveryRepository } from './repositories/TypeOrmChannelDeliveryRepository';
import { TypeOrmCampaignAuditLogRepository } from './repositories/TypeOrmCampaignAuditLogRepository';
import { TypeOrmAttributionEventRepository } from './repositories/TypeOrmAttributionEventRepository';

import { AudienceSegmentationService } from '../domain/services/AudienceSegmentationService';
import { DiscountCalculationService } from '../domain/services/DiscountCalculationService';

import { CreateCampaign } from '../application/use-cases/CreateCampaign';
import { ActivateCampaign } from '../application/use-cases/ActivateCampaign';
import { ValidateDiscountCode } from '../application/use-cases/ValidateDiscountCode';
import { ApplyDiscountCode } from '../application/use-cases/ApplyDiscountCode';
import { CreateDiscountCode } from '../application/use-cases/CreateDiscountCode';
import { GenerateDiscountCodes } from '../application/use-cases/GenerateDiscountCodes';
import { GetCampaignAnalytics } from '../application/use-cases/GetCampaignAnalytics';
import { AddCampaignStep } from '../application/use-cases/AddCampaignStep';
import { PreviewAudience } from '../application/use-cases/PreviewAudience';
import { ScheduleCampaign } from '../application/use-cases/ScheduleCampaign';
import { GetDeliveries } from '../application/use-cases/GetDeliveries';
import { GetAttributionAnalytics } from '../application/use-cases/GetAttributionAnalytics';
import { GetFunnelAnalytics } from '../application/use-cases/GetFunnelAnalytics';

import { CampaignJobRunner } from './jobs/CampaignJobRunner';

/**
 * MarketingCompositionRoot
 * Factory for creating and wiring all marketing module dependencies
 */
export class MarketingCompositionRoot {
  // Repositories
  private campaignRepository!: ICampaignRepository;
  private discountCodeRepository!: IDiscountCodeRepository;
  private sequenceRepository!: ISequenceRepository;
  private marketingEventRepository!: IMarketingEventRepository;
  private campaignStepRepository!: ICampaignStepRepository;
  private audienceSegmentRepository!: IAudienceSegmentRepository;
  private channelDeliveryRepository!: IChannelDeliveryRepository;
  private customerConsentRepository!: ICustomerConsentRepository;
  private attributionEventRepository!: IAttributionEventRepository;
  private campaignAuditLogRepository!: ICampaignAuditLogRepository;

  // Domain services
  private audienceSegmentationService!: AudienceSegmentationService;
  private discountCalculationService!: DiscountCalculationService;

  // Use cases (existing)
  private createCampaignUseCase!: CreateCampaign;
  private activateCampaignUseCase!: ActivateCampaign;
  private validateDiscountCodeUseCase!: ValidateDiscountCode;
  private applyDiscountCodeUseCase!: ApplyDiscountCode;
  private createDiscountCodeUseCase!: CreateDiscountCode;
  private generateDiscountCodesUseCase!: GenerateDiscountCodes;
  private getCampaignAnalyticsUseCase!: GetCampaignAnalytics;

  // Use cases (WS-A)
  private addCampaignStepUseCase!: AddCampaignStep;
  private previewAudienceUseCase!: PreviewAudience;
  private scheduleCampaignUseCase!: ScheduleCampaign;
  private getDeliveriesUseCase!: GetDeliveries;

  // Use cases (WS-D)
  private getAttributionAnalyticsUseCase!: GetAttributionAnalytics;
  private getFunnelAnalyticsUseCase!: GetFunnelAnalytics;

  // Infrastructure
  private jobRunner!: CampaignJobRunner;

  constructor(config: { dataSource: DataSource; logger: Logger; eventBus: IEventBus }) {
    this.initialize(config);
  }

  private initialize(config: {
    dataSource: DataSource;
    logger: Logger;
    eventBus: IEventBus;
  }): void {
    // ─── Initialize repositories ──────────────────────────────
    this.campaignRepository = new TypeOrmCampaignRepository(config.dataSource);
    this.discountCodeRepository = new TypeOrmDiscountCodeRepository(config.dataSource);
    this.marketingEventRepository = new TypeOrmMarketingEventRepository(config.dataSource);
    this.campaignStepRepository = new TypeOrmCampaignStepRepository(config.dataSource);
    this.audienceSegmentRepository = new TypeOrmAudienceSegmentRepository(config.dataSource);
    this.channelDeliveryRepository = new TypeOrmChannelDeliveryRepository(config.dataSource);
    this.campaignAuditLogRepository = new TypeOrmCampaignAuditLogRepository(config.dataSource);
    this.attributionEventRepository = new TypeOrmAttributionEventRepository(config.dataSource);

    // Sequence repository still a stub until email sequences are fully implemented
    this.sequenceRepository = {} as any;

    // Consent repository stub (no TypeORM impl yet)
    this.customerConsentRepository = {} as any;

    // ─── Initialize domain services ──────────────────────────
    this.audienceSegmentationService = new AudienceSegmentationService();
    this.discountCalculationService = new DiscountCalculationService();

    // ─── Initialize existing use cases ───────────────────────
    this.createCampaignUseCase = new CreateCampaign(
      this.campaignRepository,
      this.audienceSegmentationService,
    );

    this.activateCampaignUseCase = new ActivateCampaign(
      this.campaignRepository,
      this.discountCodeRepository,
      this.sequenceRepository,
    );

    this.validateDiscountCodeUseCase = new ValidateDiscountCode(
      this.discountCodeRepository,
      this.discountCalculationService,
    );

    this.createDiscountCodeUseCase = new CreateDiscountCode(this.discountCodeRepository);

    this.applyDiscountCodeUseCase = new ApplyDiscountCode(
      this.discountCodeRepository,
      this.marketingEventRepository,
      this.discountCalculationService,
    );

    this.generateDiscountCodesUseCase = new GenerateDiscountCodes(this.discountCodeRepository);

    this.getCampaignAnalyticsUseCase = new GetCampaignAnalytics(
      this.campaignRepository,
      this.marketingEventRepository,
    );

    // ─── Initialize WS-A use cases ───────────────────────────
    this.addCampaignStepUseCase = new AddCampaignStep(
      this.campaignRepository,
      this.campaignStepRepository,
      this.campaignAuditLogRepository,
    );

    this.previewAudienceUseCase = new PreviewAudience(
      this.audienceSegmentRepository,
      this.customerConsentRepository,
      this.audienceSegmentationService,
    );

    this.scheduleCampaignUseCase = new ScheduleCampaign(
      this.campaignRepository,
      this.campaignStepRepository,
      this.campaignAuditLogRepository,
    );

    this.getDeliveriesUseCase = new GetDeliveries(this.channelDeliveryRepository);

    // ─── Initialize WS-D use cases ──────────────────────────
    this.getAttributionAnalyticsUseCase = new GetAttributionAnalytics(
      this.attributionEventRepository,
    );

    this.getFunnelAnalyticsUseCase = new GetFunnelAnalytics(this.attributionEventRepository);

    // ─── Initialize job runner ───────────────────────────────
    this.jobRunner = new CampaignJobRunner(config.dataSource, config.logger);
  }

  // ─── Repository getters ──────────────────────────────────────
  getCampaignRepository(): ICampaignRepository {
    return this.campaignRepository;
  }
  getDiscountCodeRepository(): IDiscountCodeRepository {
    return this.discountCodeRepository;
  }
  getSequenceRepository(): ISequenceRepository {
    return this.sequenceRepository;
  }
  getMarketingEventRepository(): IMarketingEventRepository {
    return this.marketingEventRepository;
  }
  getCampaignStepRepository(): ICampaignStepRepository {
    return this.campaignStepRepository;
  }
  getAudienceSegmentRepository(): IAudienceSegmentRepository {
    return this.audienceSegmentRepository;
  }
  getChannelDeliveryRepository(): IChannelDeliveryRepository {
    return this.channelDeliveryRepository;
  }
  getAttributionEventRepository(): IAttributionEventRepository {
    return this.attributionEventRepository;
  }
  getCampaignAuditLogRepository(): ICampaignAuditLogRepository {
    return this.campaignAuditLogRepository;
  }

  // ─── Existing use case getters ───────────────────────────────
  getCreateCampaignUseCase(): CreateCampaign {
    return this.createCampaignUseCase;
  }
  getActivateCampaignUseCase(): ActivateCampaign {
    return this.activateCampaignUseCase;
  }
  getValidateDiscountCodeUseCase(): ValidateDiscountCode {
    return this.validateDiscountCodeUseCase;
  }
  getApplyDiscountCodeUseCase(): ApplyDiscountCode {
    return this.applyDiscountCodeUseCase;
  }
  getCreateDiscountCodeUseCase(): CreateDiscountCode {
    return this.createDiscountCodeUseCase;
  }
  getGenerateDiscountCodesUseCase(): GenerateDiscountCodes {
    return this.generateDiscountCodesUseCase;
  }
  getGetCampaignAnalyticsUseCase(): GetCampaignAnalytics {
    return this.getCampaignAnalyticsUseCase;
  }

  // ─── WS-A use case getters ───────────────────────────────────
  getAddCampaignStepUseCase(): AddCampaignStep {
    return this.addCampaignStepUseCase;
  }
  getPreviewAudienceUseCase(): PreviewAudience {
    return this.previewAudienceUseCase;
  }
  getScheduleCampaignUseCase(): ScheduleCampaign {
    return this.scheduleCampaignUseCase;
  }
  getGetDeliveriesUseCase(): GetDeliveries {
    return this.getDeliveriesUseCase;
  }

  // ─── WS-D use case getters ───────────────────────────────────
  getGetAttributionAnalyticsUseCase(): GetAttributionAnalytics {
    return this.getAttributionAnalyticsUseCase;
  }
  getGetFunnelAnalyticsUseCase(): GetFunnelAnalytics {
    return this.getFunnelAnalyticsUseCase;
  }

  // ─── Job runner ──────────────────────────────────────────────
  getJobRunner(): CampaignJobRunner {
    return this.jobRunner;
  }
}
