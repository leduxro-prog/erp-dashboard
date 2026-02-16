import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { DataSource } from 'typeorm';
import { TierCalculationService } from '../../domain/services/TierCalculationService';
import { ValidationError } from '@shared/errors/BaseError';

export interface CustomerProfileResponse {
  id: number;
  company_name: string;
  cui: string;
  reg_com_number: string;
  tier: string;
  tier_discount_percent: number;
  discount_percentage: number;
  credit_limit: number;
  credit_used: number;
  credit_available: number;
  payment_terms_days: number;
  status: string;
  is_active: boolean;
  contact_person: string;
  email: string;
  phone: string;
  billing_address: string;
  shipping_address: string;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
}

export interface AddressResponse {
  id: number;
  label: string;
  address: string;
  address_type: 'shipping' | 'billing' | 'both';
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export class B2BCustomerController {
  private tierService: TierCalculationService;

  constructor(private readonly dataSource: DataSource) {
    this.tierService = new TierCalculationService();
  }

  private getB2BCustomerId(req: AuthenticatedRequest): number | undefined {
    const b2bCustomer = (req as any).b2bCustomer;
    const id = b2bCustomer?.customer_id ?? b2bCustomer?.id;
    return id ? parseInt(id, 10) : undefined;
  }

  async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      const customerResult = await this.dataSource.query(
        `SELECT
          id, company_name, cui, reg_com as reg_com_number, tier, discount_percentage,
          credit_limit, credit_used, (credit_limit - credit_used) as credit_available,
          payment_terms_days, status, status = 'ACTIVE' as is_active, contact_person, email, phone,
          legal_address as billing_address, delivery_address as shipping_address, total_orders, total_spent, last_order_at,
          created_at
         FROM b2b_customers
         WHERE id = $1`,
        [customerId]
      );

      if (customerResult.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'CUSTOMER_NOT_FOUND', message: 'B2B customer not found' }
        });
        return;
      }

      const customer = customerResult[0];
      const tierDiscount = this.tierService.getDiscountForTier(customer.tier as any);

      const profile: CustomerProfileResponse = {
        id: customer.id,
        company_name: customer.company_name,
        cui: customer.cui,
        reg_com_number: customer.reg_com_number || '',
        tier: customer.tier,
        tier_discount_percent: tierDiscount * 100,
        discount_percentage: parseFloat(customer.discount_percentage) || 0,
        credit_limit: parseFloat(customer.credit_limit) || 0,
        credit_used: parseFloat(customer.credit_used) || 0,
        credit_available: parseFloat(customer.credit_available) || 0,
        payment_terms_days: customer.payment_terms_days || 30,
        status: customer.status,
        is_active: customer.is_active,
        contact_person: customer.contact_person || '',
        email: customer.email || '',
        phone: customer.phone || '',
        billing_address: customer.billing_address || '',
        shipping_address: customer.shipping_address || '',
        total_orders: customer.total_orders || 0,
        total_spent: parseFloat(customer.total_spent) || 0,
        last_order_at: customer.last_order_at,
        created_at: customer.created_at,
      };

      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      const allowedFields = ['contact_person', 'phone', 'billing_address', 'shipping_address'];
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramIndex}`);
          values.push(req.body[field]);
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_UPDATES', message: 'No valid fields to update' }
        });
        return;
      }

      updates.push(`updated_at = NOW()`);
      values.push(customerId);

      await this.dataSource.query(
        `UPDATE b2b_customers SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      const customerResult = await this.dataSource.query(
        `SELECT
          id, company_name, cui, reg_com as reg_com_number, tier, discount_percentage,
          credit_limit, credit_used, (credit_limit - credit_used) as credit_available,
          payment_terms_days, status, status = 'ACTIVE' as is_active, contact_person, email, phone,
          legal_address as billing_address, delivery_address as shipping_address, total_orders, total_spent, last_order_at,
          created_at, updated_at
         FROM b2b_customers
         WHERE id = $1`,
        [customerId]
      );

      const customer = customerResult[0];
      const tierDiscount = this.tierService.getDiscountForTier(customer.tier as any);

      res.status(200).json({
        success: true,
        data: {
          id: customer.id,
          company_name: customer.company_name,
          cui: customer.cui,
          reg_com_number: customer.reg_com_number || '',
          tier: customer.tier,
          tier_discount_percent: tierDiscount * 100,
          discount_percentage: parseFloat(customer.discount_percentage) || 0,
          credit_limit: parseFloat(customer.credit_limit) || 0,
          credit_used: parseFloat(customer.credit_used) || 0,
          credit_available: parseFloat(customer.credit_available) || 0,
          payment_terms_days: customer.payment_terms_days || 30,
          status: customer.status,
          is_active: customer.is_active,
          contact_person: customer.contact_person || '',
          email: customer.email || '',
          phone: customer.phone || '',
          billing_address: customer.billing_address || '',
          shipping_address: customer.shipping_address || '',
          total_orders: customer.total_orders || 0,
          total_spent: parseFloat(customer.total_spent) || 0,
          last_order_at: customer.last_order_at,
          created_at: customer.created_at,
          updated_at: customer.updated_at,
        },
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getAddresses(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      const addresses = await this.dataSource.query(
        `SELECT id, label, address, address_type, is_default, created_at, updated_at
         FROM customer_addresses
         WHERE customer_id = $1
         ORDER BY is_default DESC, created_at DESC`,
        [customerId]
      );

      const formattedAddresses: AddressResponse[] = addresses.map((addr: any) => ({
        id: addr.id,
        label: addr.label,
        address: addr.address,
        address_type: addr.address_type,
        is_default: addr.is_default || false,
        created_at: addr.created_at,
        updated_at: addr.updated_at,
      }));

      res.status(200).json({
        success: true,
        data: formattedAddresses,
      });
    } catch (error) {
      next(error);
    }
  }

  async addAddress(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      const { label, address, address_type = 'both', set_default = false } = req.body;

      if (!label || !address) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Label and address are required' }
        });
        return;
      }

      const existingAddress = await this.dataSource.query(
        `SELECT id FROM customer_addresses WHERE customer_id = $1 AND label = $2`,
        [customerId, label]
      );

      if (existingAddress.length > 0) {
        res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_LABEL', message: 'Address with this label already exists' }
        });
        return;
      }

      if (set_default) {
        await this.dataSource.query(
          `UPDATE customer_addresses SET is_default = false WHERE customer_id = $1`,
          [customerId]
        );
      }

      const result = await this.dataSource.query(
        `INSERT INTO customer_addresses 
         (customer_id, label, address, address_type, is_default, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, label, address, address_type, is_default, created_at, updated_at`,
        [customerId, label, address, address_type, set_default]
      );

      res.status(201).json({
        success: true,
        data: {
          id: result[0].id,
          label: result[0].label,
          address: result[0].address,
          address_type: result[0].address_type,
          is_default: result[0].is_default,
          created_at: result[0].created_at,
          updated_at: result[0].updated_at,
        },
        message: 'Address added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAddress(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { id } = req.params;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      const existingAddress = await this.dataSource.query(
        `SELECT id FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
        [id, customerId]
      );

      if (existingAddress.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found' }
        });
        return;
      }

      const allowedFields = ['label', 'address', 'address_type'];
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates.push(`${field} = $${paramIndex}`);
          values.push(req.body[field]);
          paramIndex++;
        }
      }

      if (req.body.set_default !== undefined) {
        if (req.body.set_default) {
          await this.dataSource.query(
            `UPDATE customer_addresses SET is_default = false WHERE customer_id = $1`,
            [customerId]
          );
        }
        updates.push(`is_default = $${paramIndex}`);
        values.push(req.body.set_default);
        paramIndex++;
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_UPDATES', message: 'No valid fields to update' }
        });
        return;
      }

      updates.push(`updated_at = NOW()`);
      values.push(id, customerId);

      const result = await this.dataSource.query(
        `UPDATE customer_addresses 
         SET ${updates.join(', ')} 
         WHERE id = $${paramIndex} AND customer_id = $${paramIndex + 1}
         RETURNING id, label, address, address_type, is_default, created_at, updated_at`,
        values
      );

      res.status(200).json({
        success: true,
        data: {
          id: result[0].id,
          label: result[0].label,
          address: result[0].address,
          address_type: result[0].address_type,
          is_default: result[0].is_default,
          created_at: result[0].created_at,
          updated_at: result[0].updated_at,
        },
        message: 'Address updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAddress(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { id } = req.params;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      const existingAddress = await this.dataSource.query(
        `SELECT id, is_default FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
        [id, customerId]
      );

      if (existingAddress.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found' }
        });
        return;
      }

      await this.dataSource.query(
        `DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
        [id, customerId]
      );

      if (existingAddress[0].is_default) {
        const nextDefault = await this.dataSource.query(
          `SELECT id FROM customer_addresses WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [customerId]
        );

        if (nextDefault.length > 0) {
          await this.dataSource.query(
            `UPDATE customer_addresses SET is_default = true WHERE id = $1`,
            [nextDefault[0].id]
          );
        }
      }

      res.status(200).json({
        success: true,
        data: {
          deleted_address_id: parseInt(id),
        },
        message: 'Address deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async setDefaultAddress(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const customerId = this.getB2BCustomerId(req);
      const { id } = req.params;

      if (!customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'B2B customer context required' }
        });
        return;
      }

      const existingAddress = await this.dataSource.query(
        `SELECT id FROM customer_addresses WHERE id = $1 AND customer_id = $2`,
        [id, customerId]
      );

      if (existingAddress.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found' }
        });
        return;
      }

      await this.dataSource.query(
        `UPDATE customer_addresses SET is_default = false WHERE customer_id = $1`,
        [customerId]
      );

      await this.dataSource.query(
        `UPDATE customer_addresses SET is_default = true, updated_at = NOW() WHERE id = $1`,
        [id]
      );

      res.status(200).json({
        success: true,
        data: {
          default_address_id: parseInt(id),
        },
        message: 'Default address updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
