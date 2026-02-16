import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { CalculatePrice } from '../../application/use-cases/CalculatePrice';
import { CalculateOrderPricing } from '../../application/use-cases/CalculateOrderPricing';
import { ManagePromotions } from '../../application/use-cases/ManagePromotions';
import { GetTierPricing } from '../../application/use-cases/GetTierPricing';
import { ProductNotFoundError } from '../../domain/errors/ProductNotFoundError';
import { InvalidMarginError } from '../../domain/errors/InvalidMarginError';
import { successResponse, errorResponse, paginatedResponse } from '@shared/utils/response';

export class PricingController {
  constructor(
    private calculatePriceUseCase: CalculatePrice,
    private calculateOrderPricingUseCase: CalculateOrderPricing,
    private managePromotionsUseCase: ManagePromotions,
    private getTierPricingUseCase: GetTierPricing,
  ) { }

  getProductPricing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { productId } = req.validated;

      // CalculatePrice.execute expects: (productId: number, customerId?: number, quantity?: number)
      const pricing = await this.calculatePriceUseCase.execute(productId);

      res.status(200).json(successResponse(pricing));
    } catch (error) {
      this.handleError(error, res);
    }
  };

  calculateOrderPricing = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const { items, customerId } = req.validated;

      // CalculateOrderPricing.execute expects: (items: OrderItem[], customerId?: number)
      const orderPricing = await this.calculateOrderPricingUseCase.execute(
        items,
        customerId,
      );

      res.status(200).json(successResponse(orderPricing));
    } catch (error) {
      this.handleError(error, res);
    }
  };

  getTierPricing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { productId } = req.validated;

      // GetTierPricing.execute expects: (productId: number)
      const tierPricing = await this.getTierPricingUseCase.execute(productId);

      res.status(200).json(successResponse(tierPricing));
    } catch (error) {
      this.handleError(error, res);
    }
  };

  createPromotion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { productId, promotionalPrice, validFrom, validUntil, reason } =
        req.validated;

      await this.managePromotionsUseCase.createPromotion({
        productId,
        promotionalPrice,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        reason,
      });

      res.status(201).json(successResponse({ message: 'Promotion created successfully' }));
    } catch (error) {
      this.handleError(error, res);
    }
  };

  listPromotions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 20 } = req.validated;

      // ManagePromotions has getActivePromotions(productId?: number)
      const promotions = await this.managePromotionsUseCase.getActivePromotions();

      // Apply pagination in controller
      const startIdx = (page - 1) * limit;
      const paginatedPromotions = promotions.slice(startIdx, startIdx + limit);

      res.status(200).json(paginatedResponse(paginatedPromotions, promotions.length, page, limit));
    } catch (error) {
      this.handleError(error, res);
    }
  };

  deactivatePromotion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.validated;

      await this.managePromotionsUseCase.deactivatePromotion(id);

      res.status(200).json(successResponse({ message: 'Promotion deactivated successfully' }));
    } catch (error) {
      this.handleError(error, res);
    }
  };

  private handleError(error: any, res: Response): void {
    if (error instanceof ProductNotFoundError) {
      res.status(404).json(errorResponse('PRODUCT_NOT_FOUND', error.message, 404));
      return;
    }

    if (error instanceof InvalidMarginError) {
      res.status(422).json(errorResponse('INVALID_MARGIN', error.message, 422));
      return;
    }

    if (error instanceof Error) {
      res.status(400).json(errorResponse('BAD_REQUEST', error.message, 400));
      return;
    }

    res.status(500).json(errorResponse('INTERNAL_ERROR', 'Internal server error', 500));
  }
}
