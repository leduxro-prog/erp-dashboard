import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { B2BAuthenticatedRequest } from '@shared/middleware/b2b-auth.middleware';
import { B2BCheckoutService, CheckoutRequest } from '../../domain/services/B2BCheckoutService';
import { ValidationError } from '@shared/errors/BaseError';
import { DataSource } from 'typeorm';

export class B2BCheckoutController {
  private checkoutService: B2BCheckoutService;

  constructor(dataSource: DataSource) {
    this.checkoutService = new B2BCheckoutService(dataSource);
  }

  private getB2BCustomerId(req: AuthenticatedRequest): number | undefined {
    const b2bReq = req as B2BAuthenticatedRequest;
    if (b2bReq.b2bCustomer?.customer_id) {
      return Number(b2bReq.b2bCustomer.customer_id);
    }
    const userAny = req.user as any;
    if (userAny?.b2bCustomerId) {
      return Number(userAny.b2bCustomerId);
    }
    if (req.user?.role === 'admin' && userAny?.customer_id) {
      return Number(userAny.customer_id);
    }
    return undefined;
  }

  async validateStock(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new ValidationError('Items array is required');
      }

      const result = await this.checkoutService.validateStock(items);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async validateCredit(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { amount } = req.body;

      if (!customerId) {
        throw new ValidationError('Customer ID is required');
      }

      if (!amount || amount <= 0) {
        throw new ValidationError('Valid amount is required');
      }

      const result = await this.checkoutService.validateCredit(customerId, amount);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async processCheckout(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        throw new ValidationError('Customer ID is required');
      }

      const checkoutRequest: CheckoutRequest = {
        items: req.body.items,
        shipping_address: req.body.shipping_address,
        billing_address: req.body.billing_address,
        use_different_billing: req.body.use_different_billing,
        contact_name: req.body.contact_name,
        contact_phone: req.body.contact_phone,
        payment_method: req.body.payment_method || 'CREDIT',
        notes: req.body.notes,
        purchase_order_number: req.body.purchase_order_number,
        save_address: req.body.save_address,
        address_label: req.body.address_label,
      };

      const userId = req.user?.id;
      const result = await this.checkoutService.processCheckout(
        customerId,
        checkoutRequest,
        userId
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Order placed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCustomerAddresses(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        throw new ValidationError('Customer ID is required');
      }

      const addresses = await this.checkoutService.getCustomerAddresses(customerId);

      res.status(200).json({
        success: true,
        data: addresses,
      });
    } catch (error) {
      next(error);
    }
  }

  async saveCustomerAddress(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        throw new ValidationError('Customer ID is required');
      }

      const { label, address, address_type } = req.body;

      if (!label || !address) {
        throw new ValidationError('Label and address are required');
      }

      await this.checkoutService.saveCustomerAddress(
        customerId,
        label,
        address,
        address_type || 'both'
      );

      res.status(200).json({
        success: true,
        message: 'Address saved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCustomerProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        throw new ValidationError('Customer ID is required');
      }

      const profile = await this.checkoutService.getCustomerProfile(customerId);

      if (!profile) {
        res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }
}
