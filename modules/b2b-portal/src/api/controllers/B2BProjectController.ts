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
    try {
      const { id } = req.params;
      const customerId = req.user?.customerId || req.b2bCustomer?.id;

      // 1. Verify project exists and belongs to customer
      const project = await this.projectRepo.findOne({
        where: { id, customer_id: customerId }
      });

      if (!project) {
        res.status(404).json(errorResponse('NOT_FOUND', 'Project not found', 404));
        return;
      }

      // 2. Fetch project items
      const items = await this.itemRepo.find({
        where: { project_id: id }
      });

      if (items.length === 0) {
        res.status(400).json(errorResponse('BAD_REQUEST', 'Project is empty', 400));
        return;
      }

      // 3. Get or create active cart
      let cart = await this.dataSource.query(
        'SELECT id FROM b2b_cart WHERE customer_id = $1 AND is_active = true LIMIT 1',
        [customerId]
      );

      let cartId: string;
      if (cart.length === 0) {
        const newCart = await this.dataSource.query(
          'INSERT INTO b2b_cart (customer_id, name, is_active) VALUES ($1, $2, true) RETURNING id',
          [customerId, `Coș din Proiect: ${project.name}`]
        );
        cartId = newCart[0].id;
      } else {
        cartId = cart[0].id;
      }

      // 4. Batch upsert project items into cart_items
      for (const item of items) {
        await this.dataSource.query(`
          INSERT INTO b2b_cart_items (cart_id, product_id, quantity, notes)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (cart_id, product_id) 
          DO UPDATE SET quantity = b2b_cart_items.quantity + $3, updated_at = NOW()
        `, [cartId, item.product_id, item.quantity, item.notes]);
      }

      res.json(successResponse({ 
        cart_id: cartId, 
        items_converted: items.length,
        message: `Toate produsele din proiectul "${project.name}" au fost adăugate în coș.`
      }));
    } catch (error) {
      console.error('Project to Cart error:', error);
      res.status(500).json(errorResponse('INTERNAL_ERROR', 'Failed to convert project to cart', 500));
    }
  }
}
