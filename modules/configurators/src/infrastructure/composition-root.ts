import { Router, Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { Logger } from 'winston';
import { IEventBus } from '@shared/module-system';

import { ISessionRepository } from '../domain/repositories/ISessionRepository';
import { IRuleRepository } from '../domain/repositories/IRuleRepository';
import { ICatalogRepository } from '../domain/repositories/ICatalogRepository';

// Infrastructure repositories (TypeORM implementations)
import { TypeOrmSessionRepository } from './repositories/TypeOrmSessionRepository';
import { TypeOrmRuleRepository } from './repositories/TypeOrmRuleRepository';
import { TypeOrmCatalogRepository } from './repositories/TypeOrmCatalogRepository';

import { CreateSession } from '../application/use-cases/CreateSession';
import { AddComponent } from '../application/use-cases/AddComponent';
import { RemoveComponent } from '../application/use-cases/RemoveComponent';
import { UpdateComponent } from '../application/use-cases/UpdateComponent';
import { ValidateConfiguration } from '../application/use-cases/ValidateConfiguration';
import { CalculateConfigurationPrice } from '../application/use-cases/CalculateConfigurationPrice';
import { CompleteConfiguration } from '../application/use-cases/CompleteConfiguration';
import { ConvertToQuote } from '../application/use-cases/ConvertToQuote';
import { GetSession } from '../application/use-cases/GetSession';
import { ListSessions } from '../application/use-cases/ListSessions';
import { GetCatalog } from '../application/use-cases/GetCatalog';

import { IPricingPort } from '../application/ports/IPricingPort';
import { IInventoryPort } from '../application/ports/IInventoryPort';

/**
 * Composition Root for Configurator Module
 *
 * Manages dependency injection and creates the Express router
 * with all API endpoints.
 *
 * @function createConfiguratorsRouter
 */
export function createConfiguratorsRouter(
  dataSource: DataSource,
  eventBus: IEventBus,
  logger: Logger,
  pricingPort: IPricingPort,
  inventoryPort: IInventoryPort
): Router {
  // Initialize repositories
  const sessionRepository: ISessionRepository = new TypeOrmSessionRepository(dataSource);
  const ruleRepository: IRuleRepository = new TypeOrmRuleRepository(dataSource);
  const catalogRepository: ICatalogRepository = new TypeOrmCatalogRepository(dataSource);

  // Initialize use-cases
  const createSession = new CreateSession(sessionRepository, logger);
  const addComponent = new AddComponent(sessionRepository, ruleRepository, catalogRepository, logger);
  const removeComponent = new RemoveComponent(sessionRepository, logger);
  const updateComponent = new UpdateComponent(sessionRepository, ruleRepository, logger);
  const validateConfiguration = new ValidateConfiguration(
    sessionRepository,
    ruleRepository,
    logger
  );
  const calculatePrice = new CalculateConfigurationPrice(
    sessionRepository,
    pricingPort,
    logger
  );
  const completeConfiguration = new CompleteConfiguration(
    sessionRepository,
    ruleRepository,
    eventBus,
    logger
  );
  const convertToQuote = new ConvertToQuote(sessionRepository, eventBus, logger);
  const getSession = new GetSession(sessionRepository, logger);
  const listSessions = new ListSessions(sessionRepository, logger);
  const getCatalog = new GetCatalog(catalogRepository, inventoryPort, logger);

  // Initialize Express router
  const router = Router();

  /**
   * POST /sessions
   * Create new configuration session
   */
  router.post('/sessions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, customerId } = req.body;

      const result = await createSession.execute({
        type,
        customerId,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /sessions/:token
   * Get configuration session
   */
  router.get('/sessions/:token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;

      const session = await getSession.execute({ sessionToken: token });

      res.json({
        id: session.id,
        type: session.type,
        status: session.status,
        customerId: session.customerId,
        items: session.getItems(),
        totalPrice: session.totalPrice,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /sessions/:token/items
   * Add component to configuration
   */
  router.post('/sessions/:token/items', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;
      const { componentType, quantity, properties } = req.body;

      const session = await addComponent.execute({
        sessionToken: token,
        componentType,
        quantity,
        properties,
      });

      res.status(201).json({
        id: session.id,
        items: session.getItems(),
        totalPrice: session.totalPrice,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /sessions/:token/items/:itemId
   * Update component in configuration
   */
  router.put(
    '/sessions/:token/items/:itemId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token, itemId } = req.params;
        const { quantity, properties } = req.body;

        const session = await updateComponent.execute({
          sessionToken: token,
          itemId,
          quantity,
          properties,
        });

        res.json({
          id: session.id,
          items: session.getItems(),
          totalPrice: session.totalPrice,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /sessions/:token/items/:itemId
   * Remove component from configuration
   */
  router.delete(
    '/sessions/:token/items/:itemId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token, itemId } = req.params;

        const session = await removeComponent.execute({
          sessionToken: token,
          itemId,
        });

        res.json({
          id: session.id,
          items: session.getItems(),
          totalPrice: session.totalPrice,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /sessions/:token/validate
   * Validate configuration
   */
  router.post(
    '/sessions/:token/validate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = req.params;

        const result = await validateConfiguration.execute({
          sessionToken: token,
        });

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /sessions/:token/price
   * Calculate configuration price
   */
  router.post(
    '/sessions/:token/price',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = req.params;

        const result = await calculatePrice.execute({
          sessionToken: token,
        });

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /sessions/:token/complete
   * Complete configuration
   */
  router.post(
    '/sessions/:token/complete',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = req.params;

        const session = await completeConfiguration.execute({
          sessionToken: token,
        });

        res.json({
          id: session.id,
          status: session.status,
          items: session.getItems(),
          totalPrice: session.totalPrice,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /sessions/:token/convert-to-quote
   * Convert to quotation
   */
  router.post(
    '/sessions/:token/convert-to-quote',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = req.params;

        const result = await convertToQuote.execute({
          sessionToken: token,
        });

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /catalog/:type
   * Get component catalog
   */
  router.get('/catalog/:type', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params;

      const result = await getCatalog.execute({
        configuratorType: type as 'MAGNETIC_TRACK' | 'LED_STRIP',
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /my-sessions
   * List my sessions
   */
  router.get('/my-sessions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get customerId from authenticated request
      const authReq = req as Request & { user?: { id?: number } };
      const customerId = authReq.user?.id;
      const { page, limit } = req.query;

      const result = await listSessions.execute({
        customerId: customerId ?? 0,
        page: page ? parseInt(page as string) : 0,
        limit: limit ? parseInt(limit as string) : 20,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
