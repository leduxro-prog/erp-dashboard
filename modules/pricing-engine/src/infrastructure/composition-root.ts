import { authenticate, requireRole } from '@shared/middleware/auth.middleware';
import { Router } from 'express';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

import { PricingController } from '../api/controllers/PricingController';
import { createPricingRoutes } from '../api/routes/pricing.routes';
import { CalculateOrderPricing } from '../application/use-cases/CalculateOrderPricing';
import { CalculatePrice } from '../application/use-cases/CalculatePrice';
import { GetTierPricing } from '../application/use-cases/GetTierPricing';
import { ManagePromotions } from '../application/use-cases/ManagePromotions';
import { ManageTiers } from '../application/use-cases/ManageTiers';

import { TypeOrmPriceRepository } from './repositories/TypeOrmPriceRepository';
import { TypeOrmTierRepository } from './repositories/TypeOrmTierRepository';

/**
 * Composition Root for Pricing Engine Module
 * Orchestrates dependency injection and creates configured Express router
 */
export function createPricingEngineRouter(
  dataSource: DataSource,
  redisClient: Redis,
): Router {
  // Instantiate TypeORM repositories with DataSource and Redis
  const priceRepository = new TypeOrmPriceRepository(dataSource, redisClient);
  const tierRepository = new TypeOrmTierRepository(dataSource, redisClient);

  // Instantiate use-cases with injected repositories
  const calculatePrice = new CalculatePrice(priceRepository, tierRepository);
  const calculateOrderPricing = new CalculateOrderPricing(
    priceRepository,
    tierRepository,
  );
  const managePromotions = new ManagePromotions(priceRepository);
  const getTierPricing = new GetTierPricing(priceRepository);
  const manageTiers = new ManageTiers(tierRepository);

  // Instantiate controller with injected use-cases
  const controller = new PricingController(
    calculatePrice,
    calculateOrderPricing,
    managePromotions,
    getTierPricing,
  );

  // Create and return configured Express router
  return createPricingRoutes(controller);
}
