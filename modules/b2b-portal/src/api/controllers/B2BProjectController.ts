import { Request, Response, Router, NextFunction } from 'express';
import { DataSource, Repository } from 'typeorm';
import { B2BProjectEntity, B2BProjectMetadata } from '../../infrastructure/entities/B2BProjectEntity';
import { B2BProjectItemEntity } from '../../infrastructure/entities/B2BProjectItemEntity';
import { ProductEntity } from '../../../../catalog/src/infrastructure/entities/ProductEntity';
import { successResponse, errorResponse } from '@shared/utils/response';

/**
 * B2B Project Controller
 * Handles project folders, collaborative BOMs and project-to-cart conversion
 */
export class B2BProjectController {
  private projectRepo: Repository<B2BProjectEntity>;
  private itemRepo: Repository<B2BProjectItemEntity>;

  constructor(private readonly dataSource: DataSource) {
    this.projectRepo = this.dataSource.getRepository(B2BProjectEntity);
    this.itemRepo = this.dataSource.getRepository(B2BProjectItemEntity);
  }

  /**
   * List all projects for the customer
   */
  async listProjects(req: any, res: Response): Promise<void> {
    try {
      const customerId = req.user?.customerId || req.b2bCustomer?.id;
      
      const projects = await this.projectRepo.find({
        where: { customer_id: customerId },
        relations: ['creator'],
        order: { updated_at: 'DESC' }
      });

      res.json(successResponse(projects));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to list projects', 500));
    }
  }

  /**
   * Create a new project
   */
  async createProject(req: any, res: Response): Promise<void> {
    try {
      const customerId = req.user?.customerId || req.b2bCustomer?.id;
      const creatorId = req.user?.id;
      const { name, is_shared, metadata } = req.body;

      if (!name) {
        res.status(400).json(errorResponse('BAD_REQUEST', 'Project name is required', 400));
        return;
      }

      const project = this.projectRepo.create({
        customer_id: customerId,
        creator_id: creatorId,
        name,
        is_shared: is_shared || false,
        metadata: metadata || {}
      });

      await this.projectRepo.save(project);
      res.status(201).json(successResponse(project));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to create project', 500));
    }
  }

  /**
   * Get project details with items
   */
  async getProject(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const customerId = req.user?.customerId || req.b2bCustomer?.id;

      const project = await this.projectRepo.findOne({
        where: { id, customer_id: customerId }
      });

      if (!project) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Project not found', 404));
        return;
      }

      const items = await this.itemRepo.find({
        where: { project_id: id },
        relations: ['product']
      });

      res.json(successResponse({ ...project, items }));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to fetch project', 500));
    }
  }

  /**
   * Add item to project
   */
  async addItem(req: any, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { product_id, quantity, notes } = req.body;
      const customerId = req.user?.customerId || req.b2bCustomer?.id;

      const project = await this.projectRepo.findOne({
        where: { id, customer_id: customerId }
      });

      if (!project) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Project not found', 404));
        return;
      }

      const item = this.itemRepo.create({
        project_id: id,
        product_id,
        quantity: quantity || 1,
        notes
      });

      await this.itemRepo.save(item);
      res.status(201).json(successResponse(item));
    } catch (error) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to add item to project', 500));
    }
  }

  /**
   * Convert project to current cart
   */
  async convertToCart(req: any, res: Response): Promise<void> {
    // This logic will be implemented in the next step
    res.json(successResponse({ message: 'Conversion logic coming in next sub-task' }));
  }
}
