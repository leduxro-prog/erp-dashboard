import { Router, Request, Response } from 'express';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';
import { createModuleLogger } from '@shared/utils/logger';
import {
  CreateTemplateUseCase,
  CreateInstanceUseCase,
  ApproveStepUseCase,
  GetInstanceUseCase,
  GetPendingApprovalsUseCase,
  GetTemplateUseCase,
  EscalateWorkflowUseCase,
} from '../../application/use-cases';
import { IWorkflowTemplateRepository, IWorkflowInstanceRepository } from '../../domain/repositories';
import { WorkflowError } from '../../application/errors/WorkflowError';
import { CreateTemplateDTO, UpdateTemplateDTO } from '../../application/dtos/CreateTemplateDTO';
import { CreateInstanceDTO, ApproveDTO, EscalateDTO } from '../../application/dtos/CreateInstanceDTO';
import {
  createTemplateSchema,
  updateTemplateSchema,
  createInstanceSchema,
  approveSchema,
  escalateSchema,
  paginationSchema,
} from '../validators/WorkflowValidators';
import { IEventBus } from '@shared/module-system/module.interface';

export class WorkflowController {
  private logger = createModuleLogger('WorkflowController');
  private router: Router;

  // Use cases
  private createTemplateUseCase!: CreateTemplateUseCase;
  private createInstanceUseCase!: CreateInstanceUseCase;
  private approveStepUseCase!: ApproveStepUseCase;
  private getInstanceUseCase!: GetInstanceUseCase;
  private getPendingApprovalsUseCase!: GetPendingApprovalsUseCase;
  private getTemplateUseCase!: GetTemplateUseCase;
  private escalateWorkflowUseCase!: EscalateWorkflowUseCase;

  constructor(
    private templateRepository: IWorkflowTemplateRepository,
    private instanceRepository: IWorkflowInstanceRepository,
    private eventBus: IEventBus,
  ) {
    this.router = Router();
    this.initializeUseCases();
    this.setupRoutes();
  }

  private initializeUseCases(): void {
    this.createTemplateUseCase = new CreateTemplateUseCase(this.templateRepository);
    this.createInstanceUseCase = new CreateInstanceUseCase(this.templateRepository, this.instanceRepository, this.eventBus);
    this.approveStepUseCase = new ApproveStepUseCase(this.templateRepository, this.instanceRepository, this.eventBus);
    this.getInstanceUseCase = new GetInstanceUseCase(this.instanceRepository);
    this.getPendingApprovalsUseCase = new GetPendingApprovalsUseCase(this.instanceRepository);
    this.getTemplateUseCase = new GetTemplateUseCase(this.templateRepository);
    this.escalateWorkflowUseCase = new EscalateWorkflowUseCase(this.instanceRepository, this.templateRepository, this.eventBus);
  }

  private setupRoutes(): void {
    // Template routes
    this.router.post('/templates', this.createTemplate.bind(this));
    this.router.get('/templates/:templateId', this.getTemplate.bind(this));
    this.router.get('/templates', this.listTemplates.bind(this));
    this.router.put('/templates/:templateId', this.updateTemplate.bind(this));
    this.router.delete('/templates/:templateId', this.deleteTemplate.bind(this));

    // Instance routes
    this.router.post('/instances', this.createInstance.bind(this));
    this.router.get('/instances/:instanceId', this.getInstance.bind(this));
    this.router.get('/instances', this.listInstances.bind(this));
    this.router.get('/instances/entity/:entityType/:entityId', this.getInstanceByEntity.bind(this));

    // Approval routes
    this.router.post('/instances/:instanceId/approve', this.approveStep.bind(this));
    this.router.get('/pending-approvals', this.getPendingApprovals.bind(this));

    // Escalation routes
    this.router.post('/instances/:instanceId/escalate', this.escalateWorkflow.bind(this));

    // Analytics routes
    this.router.get('/analytics/templates/:templateId', this.getAnalytics.bind(this));
  }

  private async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = createTemplateSchema.validate(req.body);
      if (error) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', error.message));
        return;
      }

      const dto = value as CreateTemplateDTO;
      const template = await this.createTemplateUseCase.execute(dto);
      res.status(201).json(successResponse(template));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const template = await this.getTemplateUseCase.execute(templateId);
      res.json(successResponse(template));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async listTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = paginationSchema.validate(req.query);
      if (error) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', error.message));
        return;
      }

      const { page, limit } = value;
      const result = await this.templateRepository.findPaginated(page, limit);
      res.json(paginatedResponse(result.templates, result.total, page, limit));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = updateTemplateSchema.validate(req.body);
      if (error) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', error.message));
        return;
      }

      const { templateId } = req.params;
      const dto = value as UpdateTemplateDTO;
      const template = await this.templateRepository.update(templateId, dto);
      res.json(successResponse(template));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      await this.templateRepository.delete(templateId);
      res.json(successResponse({ message: 'Template deleted successfully' }));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async createInstance(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = createInstanceSchema.validate(req.body);
      if (error) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', error.message));
        return;
      }

      const dto = value as CreateInstanceDTO;
      const userId = req.user?.id || 'system';
      const instance = await this.createInstanceUseCase.execute(dto, String(userId));
      res.status(201).json(successResponse(instance));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async getInstance(req: Request, res: Response): Promise<void> {
    try {
      const { instanceId } = req.params;
      const instance = await this.getInstanceUseCase.execute(instanceId);
      res.json(successResponse(instance));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async getInstanceByEntity(req: Request, res: Response): Promise<void> {
    try {
      const { entityType, entityId } = req.params;
      const instances = await this.instanceRepository.findByEntity(entityType, entityId);
      res.json(successResponse(instances));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async listInstances(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = paginationSchema.validate(req.query);
      if (error) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', error.message));
        return;
      }

      const { page, limit } = value;
      const filters = {
        status: req.query.status,
        entityType: req.query.entityType,
        templateId: req.query.templateId,
      };

      const result = await this.instanceRepository.findPaginated(page, limit, filters);
      res.json(paginatedResponse(result.instances, result.total, page, limit));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async approveStep(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = approveSchema.validate(req.body);
      if (error) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', error.message));
        return;
      }

      const { instanceId } = req.params;
      const userId = req.user?.id || 'system';
      const approverName = (req.user as any)?.name || 'Unknown';
      const dto = value as ApproveDTO;

      await this.approveStepUseCase.execute(instanceId, String(userId), approverName, dto);
      res.json(successResponse({ message: 'Approval processed successfully' }));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async getPendingApprovals(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id || 'system';
      const instances = await this.getPendingApprovalsUseCase.execute(String(userId));
      res.json(successResponse(instances));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async escalateWorkflow(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = escalateSchema.validate(req.body);
      if (error) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', error.message));
        return;
      }

      const { instanceId } = req.params;
      const userId = req.user?.id || 'system';
      const dto = value as EscalateDTO;

      await this.escalateWorkflowUseCase.execute(instanceId, String(userId), dto);
      res.json(successResponse({ message: 'Workflow escalated successfully' }));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const period = (req.query.period as string) || '30days';

      // TODO: Implement analytics service
      const analytics = {
        templateId,
        period,
        message: 'Analytics service coming soon',
      };

      res.json(successResponse(analytics));
    } catch (err) {
      this.handleError(err, res);
    }
  }

  private handleError(err: any, res: Response): void {
    if (err instanceof WorkflowError) {
      res.status(err.statusCode).json(errorResponse(err.code, err.message, err.statusCode));
    } else {
      this.logger.error('Unexpected error', err);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
