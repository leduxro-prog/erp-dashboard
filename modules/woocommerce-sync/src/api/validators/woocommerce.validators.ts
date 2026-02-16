import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../application/errors/woocommerce.errors';

export class WooCommerceValidators {
  static validateProductId(req: Request, res: Response, next: NextFunction): void {
    const { productId } = req.params;

    if (!productId || productId.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'productId is required',
      });
      return;
    }

    next();
  }

  static validateSyncAllProductsRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const { force } = req.body || {};

    if (force !== undefined && typeof force !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'force must be a boolean',
      });
      return;
    }

    next();
  }

  static validatePullOrdersRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const { since } = req.body || {};

    if (since) {
      const date = new Date(since);
      if (isNaN(date.getTime())) {
        res.status(400).json({
          success: false,
          error: 'since must be a valid ISO date string',
        });
        return;
      }
    }

    next();
  }

  static validateAdminRole(req: Request, res: Response, next: NextFunction): void {
    // Check if user is authenticated and has admin role
    const user = req.user;

    if (!user || user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin role required',
      });
      return;
    }

    next();
  }

  static validateAuthToken(req: Request, res: Response, next: NextFunction): void {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authorization token required',
      });
      return;
    }

    // Implement your token validation logic here
    next();
  }
}
