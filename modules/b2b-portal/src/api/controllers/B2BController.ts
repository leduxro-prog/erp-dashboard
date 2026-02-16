import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { getEventBus } from '@shared/utils/event-bus';
import { DataSource } from 'typeorm';

import { RegisterB2B, RegisterB2BInput } from '../../application/use-cases/RegisterB2B';
import {
  ReviewRegistration,
  ReviewRegistrationInput,
} from '../../application/use-cases/ReviewRegistration';
import {
  AnafValidationService,
  AnafValidationResult,
} from '../../infrastructure/services/AnafValidationService';

/**
 * B2B Portal Controller
 * Handles all B2B customer, registration, cart, and bulk order operations
 */
export class B2BController {
  private readonly anafValidationService: AnafValidationService;

  private createPrefixedId(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }

  private createBulkOrderNumber(): string {
    return `BLK-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }

  constructor(
    private readonly registerB2BUseCase: RegisterB2B,
    private readonly reviewRegistrationUseCase: ReviewRegistration,
    private readonly convertCartToOrderUseCase: any,
    private readonly registrationRepository: any,
    private readonly customerRepository: any,
    private readonly savedCartRepository: any,
    private readonly bulkOrderRepository: any,
    private readonly creditTransactionRepository: any,
    private readonly dataSource: DataSource,
  ) {
    this.anafValidationService = new AnafValidationService();
  }

  private getB2BCustomerId(req: AuthenticatedRequest): string | number | undefined {
    const b2bCustomer = (req as any).b2bCustomer;
    return b2bCustomer?.customer_id ?? b2bCustomer?.id;
  }

  private isAdmin(req: AuthenticatedRequest): boolean {
    return req.user?.role === 'admin';
  }

  private getRequestBody(req: AuthenticatedRequest): Record<string, any> {
    return ((req as any).validatedBody ?? req.body ?? {}) as Record<string, any>;
  }

  private getRequestQuery(req: AuthenticatedRequest): Record<string, any> {
    return (req.validatedQuery ?? req.query ?? {}) as Record<string, any>;
  }

  async verifyCui(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cui } = req.body;

      if (!cui) {
        res.status(400).json({
          success: false,
          message: 'CUI is required',
          code: 'CUI_REQUIRED',
        });
        return;
      }

      const result: AnafValidationResult = await this.anafValidationService.validateCui(cui);

      if (!result.valid) {
        const statusCode =
          result.code === 'INVALID_FORMAT'
            ? 400
            : result.code === 'NOT_FOUND'
              ? 404
              : result.code === 'ANAF_UNAVAILABLE'
                ? 503
                : 500;

        res.status(statusCode).json({
          success: false,
          message: result.error,
          code: result.code,
        });
        return;
      }

      const company = result.company!;

      res.status(200).json({
        success: true,
        data: {
          cui: company.cui,
          denumire: company.denumire,
          adresa: company.adresa,
          nrRegCom: company.nrRegCom,
          telefon: company.telefon || '',
          codPostal: company.codPostal || '',
          stare_inregistrare: company.stareInregistrare,
          data_inregistrare: company.dataInregistrare || '',
          cod_CAEN: company.codCAEN || '',
          scpTVA: company.scpTVA,
          dataInceputTVA: company.dataInceputTVA || null,
          dataSfarsitTVA: company.dataSfarsitTVA || null,
          statusTVA: company.statusTVA,
          statusInactivi: company.statusInactivi,
          dataInactivare: company.dataInactivare || null,
          dataReactivare: company.dataReactivare || null,
          statusSplitTVA: company.statusSplitTVA,
          organFiscalCompetent: company.organFiscalCompetent || '',
          forma_juridica: company.formaJuridica || '',
          statusRO_e_Factura: company.statusROeFactura,
          validated_at: company.validatedAt,
          source: company.source,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyCuiGet(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { cui } = req.params;

      if (!cui) {
        res.status(400).json({
          success: false,
          message: 'CUI is required',
          code: 'CUI_REQUIRED',
        });
        return;
      }

      const result: AnafValidationResult = await this.anafValidationService.validateCui(cui);

      if (!result.valid) {
        const statusCode =
          result.code === 'INVALID_FORMAT'
            ? 400
            : result.code === 'NOT_FOUND'
              ? 404
              : result.code === 'ANAF_UNAVAILABLE'
                ? 503
                : 500;

        res.status(statusCode).json({
          success: false,
          message: result.error,
          code: result.code,
        });
        return;
      }

      const company = result.company!;

      res.status(200).json({
        success: true,
        data: {
          cui: company.cui,
          denumire: company.denumire,
          adresa: company.adresa,
          nrRegCom: company.nrRegCom,
          telefon: company.telefon || '',
          codPostal: company.codPostal || '',
          stare_inregistrare: company.stareInregistrare,
          data_inregistrare: company.dataInregistrare || '',
          cod_CAEN: company.codCAEN || '',
          scpTVA: company.scpTVA,
          dataInceputTVA: company.dataInceputTVA || null,
          dataSfarsitTVA: company.dataSfarsitTVA || null,
          statusTVA: company.statusTVA,
          statusInactivi: company.statusInactivi,
          dataInactivare: company.dataInactivare || null,
          dataReactivare: company.dataReactivare || null,
          statusSplitTVA: company.statusSplitTVA,
          organFiscalCompetent: company.organFiscalCompetent || '',
          forma_juridica: company.formaJuridica || '',
          statusRO_e_Factura: company.statusROeFactura,
          validated_at: company.validatedAt,
          source: company.source,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Register a new B2B customer
   *
   * @param req - Express request with validated registration data
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with registration confirmation
   */
  async registerB2BCustomer(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const input: RegisterB2BInput = {
        companyName: req.body.company_name,
        cui: req.body.company_registration_number,
        regCom: req.body.reg_com_number || req.body.company_registration_number,
        legalAddress: req.body.billing_address,
        deliveryAddress: req.body.shipping_address,
        contactPerson: req.body.contact_name,
        email: req.body.contact_email,
        phone: req.body.contact_phone,
        bankName: req.body.bank_name || '',
        iban: req.body.iban || '',
        requestedTier: req.body.requested_tier || 'STANDARD',
        paymentTermsDays: req.body.payment_terms,
        notes: req.body.notes || '',
      };

      const result = await this.registerB2BUseCase.execute(input);

      res.status(201).json({
        success: true,
        data: {
          registration_id: result.id,
          company_name: result.companyName,
          contact_email: result.email,
          status: result.status,
          created_at: result.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List B2B registrations (admin only)
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with paginated list of registrations
   */
  async listRegistrations(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        search,
        date_from,
        date_to,
      } = this.getRequestQuery(req);

      const result = await this.registrationRepository.findAll(
        { status, search, createdFromDate: date_from, createdToDate: date_to },
        { page, limit },
      );

      res.status(200).json(
        result.items.map((r: any) => ({
          id: r.id,
          companyName: r.companyName,
          cui: r.cui,
          regCom: r.regCom,
          contactPerson: r.contactPerson,
          email: r.email,
          phone: r.phone,
          legalAddress: r.legalAddress,
          status: r.status,
          createdAt: r.createdAt,
        })),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get B2B registration details
   *
   * @param req - Express request with registration ID
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with registration details
   */
  async getRegistrationDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const registration = await this.registrationRepository.findById(id);

      if (!registration) {
        res.status(404).json({
          success: false,
          error: {
            code: 'REGISTRATION_NOT_FOUND',
            message: `B2B registration with ID ${id} not found`,
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          registration_id: registration.id ?? id,
          company_name: registration.companyName,
          company_registration_number: registration.cui,
          reg_com_number: registration.regCom,
          billing_address: registration.legalAddress,
          shipping_address: registration.deliveryAddress,
          contact_name: registration.contactPerson,
          contact_email: registration.email,
          contact_phone: registration.phone,
          bank_name: registration.bankName,
          iban: registration.iban,
          requested_tier: registration.requestedTier,
          payment_terms: registration.paymentTermsDays,
          notes: registration.notes,
          status: registration.status,
          created_at: registration.createdAt,
          updated_at: registration.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Review B2B registration - approve or reject
   *
   * @param req - Express request with registration ID and review data
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with review result
   */
  async reviewRegistration(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { status, approved_credit_limit, rejection_reason, notes, tier, payment_terms } =
        req.body;
      const reviewedBy = req.user?.id || 'admin'; // Fallback for dev

      const input: ReviewRegistrationInput = {
        registrationId: id,
        action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
        tier,
        creditLimit: approved_credit_limit,
        paymentTermsDays: payment_terms,
        reason: rejection_reason,
        reviewerId: reviewedBy,
      };

      const result = await this.reviewRegistrationUseCase.execute(input);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List B2B customers
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with paginated list of customers
   */
  async listCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        tier,
        is_active,
        search,
        min_total_spent,
        max_total_spent,
      } = this.getRequestQuery(req);

      const filters = {
        tier,
        isActive: is_active !== undefined ? is_active === 'true' : undefined,
        search,
        minTotalSpent: min_total_spent ? parseFloat(min_total_spent) : undefined,
        maxTotalSpent: max_total_spent ? parseFloat(max_total_spent) : undefined,
      };

      const result = await this.customerRepository.search(filters, {
        page: Number(page),
        limit: Number(limit),
      });

      res.status(200).json({
        success: true,
        data: {
          customers: result.items.map((customer: any) => ({
            id: customer.id,
            registration_id: customer.registrationId,
            company_name: customer.companyName,
            cui: customer.cui,
            tier: customer.tier,
            credit_limit: customer.creditLimit,
            used_credit: customer.usedCredit,
            available_credit: customer.creditLimit - (customer.usedCredit || 0),
            payment_terms_days: customer.paymentTermsDays,
            is_active: customer.isActive,
            total_orders: customer.totalOrders,
            total_spent: customer.totalSpent,
            created_at: customer.createdAt,
            updated_at: customer.updatedAt,
          })),
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            total_pages: result.totalPages,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get B2B customer details
   *
   * @param req - Express request with customer ID
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with customer details
   */
  async getCustomerDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const b2bCustomerId = this.getB2BCustomerId(req);

      if (b2bCustomerId && String(id) !== String(b2bCustomerId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied for requested customer',
          },
        });
        return;
      }

      if (
        !b2bCustomerId &&
        !this.isAdmin(req) &&
        req.user?.id &&
        String(id) !== String(req.user.id)
      ) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied for requested customer',
          },
        });
        return;
      }

      const scopedCustomerId = b2bCustomerId || id;

      const customer = await this.customerRepository.findById(scopedCustomerId);

      if (!customer) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: `B2B customer with ID ${scopedCustomerId} not found`,
          },
        });
        return;
      }

      // Get recent credit transactions
      const creditTransactions = await this.dataSource.query(
        `SELECT id, amount, type, description, created_at
         FROM b2b_credit_transactions
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [scopedCustomerId],
      );

      // Get recent orders
      const recentOrders = await this.dataSource.query(
        `SELECT id, order_number, total_amount, status, created_at
         FROM b2b_orders
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [scopedCustomerId],
      );

      res.status(200).json({
        success: true,
        data: {
          customer: {
            id: customer.id,
            registration_id: customer.registrationId,
            company_name: customer.companyName,
            cui: customer.cui,
            tier: customer.tier,
            credit_limit: customer.creditLimit,
            used_credit: customer.usedCredit,
            available_credit: customer.creditLimit - (customer.usedCredit || 0),
            payment_terms_days: customer.paymentTermsDays,
            is_active: customer.isActive,
            total_orders: customer.totalOrders,
            total_spent: customer.totalSpent,
            sales_rep_id: customer.salesRepId,
            created_at: customer.createdAt,
            updated_at: customer.updatedAt,
          },
          credit_transactions: creditTransactions.map((tx: any) => ({
            id: tx.id,
            amount: parseFloat(tx.amount),
            type: tx.type,
            description: tx.description,
            created_at: tx.created_at,
          })),
          recent_orders: recentOrders.map((order: any) => ({
            id: order.id,
            order_number: order.order_number,
            total_amount: parseFloat(order.total_amount),
            status: order.status,
            created_at: order.created_at,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Adjust customer credit limit (admin only)
   *
   * @param req - Express request with customer ID and new credit limit
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with updated credit limit
   */
  async adjustCreditLimit(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { new_credit_limit, reason } = this.getRequestBody(req);
      const adjustedBy = req.user?.id;

      // Validate input
      if (!new_credit_limit || new_credit_limit < 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CREDIT_LIMIT',
            message: 'Credit limit must be a positive number',
          },
        });
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'REASON_REQUIRED',
            message: 'Reason for credit limit adjustment is required',
          },
        });
        return;
      }

      // Get current customer to retrieve old credit limit
      const customer = await this.customerRepository.findById(id);
      if (!customer) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: `B2B customer with ID ${id} not found`,
          },
        });
        return;
      }

      const oldCreditLimit = customer.creditLimit;

      // Update credit limit
      await this.customerRepository.updateCredit(id, new_credit_limit);

      // Log transaction in credit_transactions table
      await this.dataSource.query(
        `INSERT INTO b2b_credit_transactions (customer_id, amount, type, description, adjusted_by, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [id, new_credit_limit - oldCreditLimit, 'ADJUSTMENT', reason, adjustedBy || 'system'],
      );

      // TODO: Publish event: credit_limit.adjusted
      // TODO: Send notification to customer

      res.status(200).json({
        success: true,
        data: {
          customer_id: id,
          new_credit_limit,
          old_credit_limit: oldCreditLimit,
          reason,
          adjusted_at: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a saved cart
   *
   * @param req - Express request with cart data
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with saved cart details
   */
  async createSavedCart(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { cart_name, items, notes, customer_id } = this.getRequestBody(req);
      const b2bCustomerId = this.getB2BCustomerId(req);
      const customerId =
        b2bCustomerId || (this.isAdmin(req) ? customer_id || req.user?.id : req.user?.id);

      if (!customerId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CUSTOMER_ID_REQUIRED',
            message: 'Customer context is required',
          },
        });
        return;
      }

      // Validate customer exists
      const customer = await this.customerRepository.findById(customerId);
      if (!customer) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: `Customer with ID ${customerId} not found`,
          },
        });
        return;
      }

      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'EMPTY_CART',
            message: 'Cart must contain at least one item',
          },
        });
        return;
      }

      // Validate cart name
      if (!cart_name || cart_name.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CART_NAME',
            message: 'Cart name is required',
          },
        });
        return;
      }

      // Validate and enrich items with product details
      const enrichedItems = [];
      let totalAmount = 0;

      for (const item of items) {
        if (!item.product_id || !item.quantity) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_ITEM',
              message: 'Each item must have product_id and quantity',
            },
          });
          return;
        }

        // Get product details
        const productQuery = `
          SELECT id, sku, name, base_price
          FROM products
          WHERE id = $1 AND is_active = true
        `;
        const productResult = await this.dataSource.query(productQuery, [item.product_id]);

        if (productResult.length === 0) {
          res.status(404).json({
            success: false,
            error: {
              code: 'PRODUCT_NOT_FOUND',
              message: `Product with ID ${item.product_id} not found or inactive`,
            },
          });
          return;
        }

        const product = productResult[0];
        const unitPrice = item.price || parseFloat(product.base_price);
        const quantity = parseInt(item.quantity);
        const subtotal = unitPrice * quantity;

        enrichedItems.push({
          id: this.createPrefixedId('item'),
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: quantity,
          unitPrice: unitPrice,
          subtotal: subtotal,
          notes: item.notes || undefined,
        });

        totalAmount += subtotal;
      }

      // Create saved cart entity
      const cartId = this.createPrefixedId('cart');
      const savedCart = {
        id: cartId,
        customerId: customerId,
        name: cart_name,
        description: notes,
        items: enrichedItems,
        totalAmount: totalAmount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      await this.dataSource.query(
        `INSERT INTO saved_carts (id, customer_id, name, description, items, total_amount, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          savedCart.id,
          savedCart.customerId,
          savedCart.name,
          savedCart.description,
          JSON.stringify(savedCart.items),
          savedCart.totalAmount,
          savedCart.createdAt,
          savedCart.updatedAt,
        ],
      );

      res.status(201).json({
        success: true,
        data: {
          cart_id: savedCart.id,
          cart_name: savedCart.name,
          customer_id: savedCart.customerId,
          items: enrichedItems.map((item) => ({
            product_id: item.productId,
            product_name: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            subtotal: item.subtotal,
            notes: item.notes,
          })),
          item_count: enrichedItems.length,
          total_amount: totalAmount,
          notes: notes,
          created_at: savedCart.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List saved carts
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with paginated list of saved carts
   */
  async listSavedCarts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { page = 1, limit = 20, search, customer_id } = this.getRequestQuery(req);
      const b2bCustomerId = this.getB2BCustomerId(req);
      const customerId = b2bCustomerId || (this.isAdmin(req) ? customer_id : req.user?.id);

      // Validate customer exists
      if (customerId) {
        const customer = await this.customerRepository.findById(customerId);
        if (!customer) {
          res.status(404).json({
            success: false,
            error: {
              code: 'CUSTOMER_NOT_FOUND',
              message: `Customer with ID ${customerId} not found`,
            },
          });
          return;
        }
      }

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build WHERE clause
      let whereClause = customerId ? 'WHERE sc.customer_id = $1' : 'WHERE 1=1';
      const params: any[] = customerId ? [customerId] : [];
      const countParams: any[] = customerId ? [customerId] : [];

      if (search) {
        const searchIndex = params.length + 1;
        whereClause += ` AND sc.name ILIKE $${searchIndex}`;
        params.push(`%${search}%`);
        countParams.push(`%${search}%`);
      }

      // Add pagination params
      params.push(limitNum);
      params.push(offset);

      // Count total carts
      const countQuery = `
        SELECT COUNT(*) as total
        FROM saved_carts sc
        ${whereClause}
      `;
      const countResult = await this.dataSource.query(countQuery, countParams);
      const total = parseInt(countResult[0]?.total || '0', 10);

      // Fetch saved carts
      const query = `
        SELECT
          sc.id,
          sc.customer_id,
          sc.name,
          sc.description,
          sc.items,
          sc.total_amount,
          sc.created_at,
          sc.updated_at,
          c.company_name
        FROM saved_carts sc
        LEFT JOIN b2b_customers c ON sc.customer_id = c.id
        ${whereClause}
        ORDER BY sc.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;

      const carts = await this.dataSource.query(query, params);

      res.status(200).json({
        success: true,
        data: {
          carts: carts.map((cart: any) => {
            const items = typeof cart.items === 'string' ? JSON.parse(cart.items) : cart.items;
            return {
              cart_id: cart.id,
              customer_id: cart.customer_id,
              company_name: cart.company_name,
              cart_name: cart.name,
              description: cart.description,
              items: items.map((item: any) => ({
                product_id: item.productId,
                product_name: item.productName,
                sku: item.sku,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                subtotal: item.subtotal,
                notes: item.notes,
              })),
              item_count: items.length,
              total_items: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
              total_amount: parseFloat(cart.total_amount),
              created_at: cart.created_at,
              updated_at: cart.updated_at,
            };
          }),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            total_pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create bulk order
   *
   * @param req - Express request with bulk order data
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with created bulk order details
   */
  async createBulkOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { items, shipping_address, notes, customer_id } = this.getRequestBody(req);
      const b2bCustomerId = this.getB2BCustomerId(req);
      const customerId =
        b2bCustomerId || (this.isAdmin(req) ? customer_id || req.user?.id : req.user?.id);

      if (!customerId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'CUSTOMER_ID_REQUIRED',
            message: 'Customer context is required',
          },
        });
        return;
      }

      // Validate customer exists
      const customer = await this.customerRepository.findById(customerId);
      if (!customer) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CUSTOMER_NOT_FOUND',
            message: `Customer with ID ${customerId} not found`,
          },
        });
        return;
      }

      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'EMPTY_ORDER',
            message: 'Order must contain at least one item',
          },
        });
        return;
      }

      // Validate and process items
      const orderItems = [];
      let totalAmount = 0;
      const stockErrors = [];

      for (const item of items) {
        if (!item.product_id || !item.quantity) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_ITEM',
              message: 'Each item must have product_id and quantity',
            },
          });
          return;
        }

        // Get product details and stock
        const productQuery = `
          SELECT
            p.id,
            p.sku,
            p.name,
            p.base_price,
            COALESCE(SUM(sl.quantity_available), 0) as stock_available
          FROM products p
          LEFT JOIN stock_levels sl ON p.id = sl.product_id
          WHERE p.id = $1 AND p.is_active = true
          GROUP BY p.id, p.sku, p.name, p.base_price
        `;
        const productResult = await this.dataSource.query(productQuery, [item.product_id]);

        if (productResult.length === 0) {
          res.status(404).json({
            success: false,
            error: {
              code: 'PRODUCT_NOT_FOUND',
              message: `Product with ID ${item.product_id} not found or inactive`,
            },
          });
          return;
        }

        const product = productResult[0];
        const quantity = parseInt(item.quantity);
        const stockAvailable = parseInt(product.stock_available);

        // Check stock availability
        if (stockAvailable < quantity) {
          stockErrors.push({
            product_id: product.id,
            sku: product.sku,
            name: product.name,
            requested: quantity,
            available: stockAvailable,
          });
        }

        const unitPrice = parseFloat(product.base_price);
        const lineTotal = unitPrice * quantity;

        orderItems.push({
          id: this.createPrefixedId('item'),
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          quantity: quantity,
          unitPrice: unitPrice,
          lineTotal: lineTotal,
        });

        totalAmount += lineTotal;
      }

      // If there are stock errors, return them
      if (stockErrors.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Some items have insufficient stock',
            details: stockErrors,
          },
        });
        return;
      }

      // Check credit limit
      const availableCredit = customer.creditLimit - (customer.usedCredit || 0);
      if (totalAmount > availableCredit) {
        res.status(402).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_CREDIT',
            message: 'Order total exceeds available credit',
            details: {
              order_total: totalAmount,
              credit_limit: customer.creditLimit,
              used_credit: customer.usedCredit || 0,
              available_credit: availableCredit,
              shortfall: totalAmount - availableCredit,
            },
          },
        });
        return;
      }

      // Generate order number
      const orderNumber = this.createBulkOrderNumber();
      const orderId = this.createPrefixedId('order');

      // Create bulk order in database
      const orderData = {
        id: orderId,
        customerId: customerId,
        orderNumber: orderNumber,
        status: 'PENDING',
        items: orderItems,
        totalAmount: totalAmount,
        itemCount: orderItems.length,
        notes: notes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.dataSource.query(
        `INSERT INTO bulk_orders (id, customer_id, order_number, status, items, total_amount, item_count, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          orderData.id,
          orderData.customerId,
          orderData.orderNumber,
          orderData.status,
          JSON.stringify(orderData.items),
          orderData.totalAmount,
          orderData.itemCount,
          orderData.notes,
          orderData.createdAt,
          orderData.updatedAt,
        ],
      );

      // Deduct stock for each ordered item
      for (const item of orderItems) {
        await this.dataSource.query(
          `UPDATE stock_levels
           SET quantity_available = quantity_available - $1,
               updated_at = NOW()
           WHERE product_id = $2
           AND id = (
             SELECT id FROM stock_levels
             WHERE product_id = $2 AND quantity_available >= $1
             LIMIT 1
           )`,
          [item.quantity, item.productId],
        );
      }

      // Update customer used credit
      const newUsedCredit = (customer.usedCredit || 0) + totalAmount;
      await this.dataSource.query(
        `UPDATE b2b_customers SET used_credit = $1, updated_at = NOW() WHERE id = $2`,
        [newUsedCredit, customerId],
      );

      // Log credit transaction
      await this.dataSource.query(
        `INSERT INTO b2b_credit_transactions (id, customer_id, amount, type, description, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          this.createPrefixedId('tx'),
          customerId,
          totalAmount,
          'ORDER',
          `Bulk order ${orderNumber}`,
        ],
      );

      try {
        await getEventBus().publish('b2b.bulk_order', {
          orderId: orderData.id,
          orderNumber: orderData.orderNumber,
          customerId: customerId,
          totalAmount: totalAmount,
          itemCount: orderItems.length,
          createdAt: orderData.createdAt,
        });
      } catch (eventError) {
        console.error('Failed to publish b2b.bulk_order event:', eventError);
      }

      res.status(201).json({
        success: true,
        data: {
          order_id: orderData.id,
          order_number: orderData.orderNumber,
          customer_id: orderData.customerId,
          status: orderData.status,
          items: orderItems.map((item) => ({
            product_id: item.productId,
            sku: item.sku,
            product_name: item.productName,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            line_total: item.lineTotal,
          })),
          item_count: orderData.itemCount,
          total_amount: orderData.totalAmount,
          shipping_address: shipping_address,
          notes: orderData.notes,
          credit_info: {
            previous_used_credit: customer.usedCredit || 0,
            new_used_credit: newUsedCredit,
            credit_limit: customer.creditLimit,
            available_credit: customer.creditLimit - newUsedCredit,
          },
          created_at: orderData.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List bulk orders
   *
   * @param req - Express request with query parameters
   * @param res - Express response
   * @param next - Express next middleware function
   *
   * @returns JSON with paginated list of bulk orders
   */
  async listBulkOrders(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        date_from,
        date_to,
        customer_id,
      } = this.getRequestQuery(req);
      const b2bCustomerId = this.getB2BCustomerId(req);
      const customerId = b2bCustomerId || (this.isAdmin(req) ? customer_id : req.user?.id);

      // Validate customer exists if customer_id is provided
      if (customerId) {
        const customer = await this.customerRepository.findById(customerId);
        if (!customer) {
          res.status(404).json({
            success: false,
            error: {
              code: 'CUSTOMER_NOT_FOUND',
              message: `Customer with ID ${customerId} not found`,
            },
          });
          return;
        }
      }

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build WHERE clause
      let whereClause = customerId ? 'WHERE bo.customer_id = $1' : 'WHERE 1=1';
      const params: any[] = customerId ? [customerId] : [];
      const countParams: any[] = customerId ? [customerId] : [];

      if (status) {
        const statusIndex = params.length + 1;
        whereClause += ` AND bo.status = $${statusIndex}`;
        params.push(status.toUpperCase());
        countParams.push(status.toUpperCase());
      }

      if (date_from) {
        const dateFromIndex = params.length + 1;
        whereClause += ` AND bo.created_at >= $${dateFromIndex}`;
        params.push(date_from);
        countParams.push(date_from);
      }

      if (date_to) {
        const dateToIndex = params.length + 1;
        whereClause += ` AND bo.created_at <= $${dateToIndex}`;
        params.push(date_to);
        countParams.push(date_to);
      }

      // Add pagination params
      params.push(limitNum);
      params.push(offset);

      // Count total orders
      const countQuery = `
        SELECT COUNT(*) as total
        FROM bulk_orders bo
        ${whereClause}
      `;
      const countResult = await this.dataSource.query(countQuery, countParams);
      const total = parseInt(countResult[0]?.total || '0', 10);

      // Fetch bulk orders
      const query = `
        SELECT
          bo.id,
          bo.customer_id,
          bo.order_number,
          bo.status,
          bo.items,
          bo.total_amount,
          bo.item_count,
          bo.notes,
          bo.confirmed_at,
          bo.shipped_at,
          bo.delivered_at,
          bo.created_at,
          bo.updated_at,
          c.company_name,
          c.tier
        FROM bulk_orders bo
        LEFT JOIN b2b_customers c ON bo.customer_id = c.id
        ${whereClause}
        ORDER BY bo.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;

      const orders = await this.dataSource.query(query, params);

      res.status(200).json({
        success: true,
        data: {
          orders: orders.map((order: any) => {
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            return {
              order_id: order.id,
              order_number: order.order_number,
              customer_id: order.customer_id,
              company_name: order.company_name,
              tier: order.tier,
              status: order.status,
              items: items.map((item: any) => ({
                product_id: item.productId,
                sku: item.sku,
                product_name: item.productName,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                line_total: item.lineTotal,
              })),
              item_count: order.item_count,
              total_items: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
              total_amount: parseFloat(order.total_amount),
              notes: order.notes,
              confirmed_at: order.confirmed_at,
              shipped_at: order.shipped_at,
              delivered_at: order.delivered_at,
              created_at: order.created_at,
              updated_at: order.updated_at,
            };
          }),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            total_pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * List products for B2B catalog
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  async listProducts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 100, search, category } = req.query as Record<string, any>;

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build WHERE clause
      let whereClause = 'WHERE p.is_active = true AND p.base_price > 0';
      const params: any[] = [limitNum, offset];
      const countParams: any[] = [];

      if (search) {
        whereClause += ' AND (p.sku ILIKE $3 OR p.name ILIKE $3)';
        params.push(`%${search}%`);
        countParams.push(`%${search}%`);
      }

      if (category) {
        const categoryIndex = search ? 4 : 3;
        whereClause += ` AND c.name ILIKE $${categoryIndex}`;
        params.push(`%${category}%`);
        countParams.push(`%${category}%`);
      }

      // Count total products
      const countWhereClause = whereClause.replace(/\$3/g, '$1').replace(/\$4/g, '$2');
      const countQuery = `
        SELECT COUNT(*) as total
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ${countWhereClause}
      `;
      const countResult = await this.dataSource.query(countQuery, countParams);
      const total = parseInt(countResult[0]?.total || '0', 10);

      // Fetch products with stock information
      const query = `
        SELECT
          p.id,
          p.sku,
          p.name,
          p.description,
          p.base_price as price,
          p.currency_code as currency,
          c.name as category,
          COALESCE(stock_total.quantity, 0) as stock_available,
          3 as supplier_lead_time
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN (
          SELECT product_id, SUM(quantity_available) as quantity
          FROM stock_levels
          GROUP BY product_id
        ) stock_total ON p.id = stock_total.product_id
        ${whereClause}
        ORDER BY p.updated_at DESC, p.name ASC
        LIMIT $1 OFFSET $2
      `;

      const products = await this.dataSource.query(query, params);

      res.status(200).json({
        success: true,
        data: {
          products: products.map((p: any) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            description: p.description || '',
            price: parseFloat(p.price) || 0,
            currency: p.currency || 'RON',
            image_url: '',
            category: p.category || '',
            stock_local: parseInt(p.stock_available) || 0,
            stock_supplier: 0,
            supplier_lead_time: 3,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            total_pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product details for B2B catalog
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  async getProductDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          p.id,
          p.sku,
          p.name,
          p.description,
          p.base_price as price,
          p.currency_code as currency,
          c.name as category,
          COALESCE(stock_total.quantity, 0) as stock_available,
          3 as supplier_lead_time
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN (
          SELECT product_id, SUM(quantity_available) as quantity
          FROM stock_levels
          GROUP BY product_id
        ) stock_total ON p.id = stock_total.product_id
        WHERE p.id = $1 AND p.is_active = true
      `;

      const products = await this.dataSource.query(query, [id]);

      if (products.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Product not found',
        });
        return;
      }

      const p = products[0];
      res.status(200).json({
        success: true,
        data: {
          id: p.id,
          sku: p.sku,
          name: p.name,
          description: p.description || '',
          price: parseFloat(p.price) || 0,
          currency: p.currency || 'RON',
          image_url: p.image_url || '',
          category: p.category || '',
          stock_local: parseInt(p.stock_available) || 0,
          stock_supplier: 0,
          supplier_lead_time: 3,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available product filters (brands, ip ratings, color temperatures, etc.)
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  async getProductFilters(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { category_id } = req.query as Record<string, any>;
      const rawCategoryId = Array.isArray(category_id) ? category_id[0] : category_id;
      const parsedCategoryId =
        rawCategoryId !== undefined && rawCategoryId !== null ? Number(rawCategoryId) : null;
      const hasCategoryFilter = Number.isFinite(parsedCategoryId);

      let catCondition = '';
      const params: number[] = [];

      if (hasCategoryFilter && parsedCategoryId !== null) {
        catCondition = 'AND (p.category_id = $1 OR c.parent_id = $1)';
        params.push(parsedCategoryId);
      }

      const [brands, ipRatings, colorTemps, mountingTypes, priceRange] = await Promise.all([
        this.dataSource.query(
          `
          SELECT DISTINCT ps.brand, COUNT(*) as count
          FROM product_specifications ps
          JOIN products p ON p.id = ps.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE ps.brand IS NOT NULL AND p.is_active = true ${catCondition}
          GROUP BY ps.brand ORDER BY count DESC
        `,
          params,
        ),
        this.dataSource.query(
          `
          SELECT DISTINCT ps.ip_rating, COUNT(*) as count
          FROM product_specifications ps
          JOIN products p ON p.id = ps.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE ps.ip_rating IS NOT NULL AND p.is_active = true ${catCondition}
          GROUP BY ps.ip_rating ORDER BY ps.ip_rating
        `,
          params,
        ),
        this.dataSource.query(
          `
          SELECT DISTINCT ps.color_temperature, COUNT(*) as count
          FROM product_specifications ps
          JOIN products p ON p.id = ps.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE ps.color_temperature IS NOT NULL AND p.is_active = true ${catCondition}
          GROUP BY ps.color_temperature ORDER BY ps.color_temperature
        `,
          params,
        ),
        this.dataSource.query(
          `
          SELECT DISTINCT ps.mounting_type, COUNT(*) as count
          FROM product_specifications ps
          JOIN products p ON p.id = ps.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE ps.mounting_type IS NOT NULL AND p.is_active = true ${catCondition}
          GROUP BY ps.mounting_type ORDER BY count DESC
        `,
          params,
        ),
        this.dataSource.query(
          `
          SELECT MIN(p.base_price) as min_price, MAX(p.base_price) as max_price
          FROM products p
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE p.is_active = true ${catCondition}
        `,
          params,
        ),
      ]);

      res.status(200).json({
        success: true,
        data: {
          brands: brands.map((b: any) => ({ value: b.brand, count: parseInt(b.count) })),
          ip_ratings: ipRatings.map((r: any) => ({ value: r.ip_rating, count: parseInt(r.count) })),
          color_temperatures: colorTemps.map((t: any) => ({
            value: t.color_temperature,
            count: parseInt(t.count),
            label: `${t.color_temperature}K`,
          })),
          mounting_types: mountingTypes.map((m: any) => ({
            value: m.mounting_type,
            count: parseInt(m.count),
          })),
          price_range: {
            min: parseFloat(priceRange[0]?.min_price || '0'),
            max: parseFloat(priceRange[0]?.max_price || '0'),
          },
          wattage_range: { min: 3, max: 200 },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product categories tree
   *
   * @param req - Express request
   * @param res - Express response
   * @param next - Next function
   */
  async getProductCategories(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const categories = await this.dataSource.query(`
        SELECT c.id, c.name, c.slug, c.description, c.parent_id, c.sort_order, c.is_active,
               COUNT(DISTINCT p.id) as product_count,
               pc.name as parent_name
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
        LEFT JOIN categories pc ON c.parent_id = pc.id
        WHERE c.is_active = true
        GROUP BY c.id, c.name, c.slug, c.description, c.parent_id, c.sort_order, c.is_active, pc.name
        ORDER BY c.sort_order, c.name
      `);

      // Build tree structure
      const roots = categories.filter((c: any) => !c.parent_id);
      const tree = roots.map((root: any) => ({
        ...root,
        product_count: parseInt(root.product_count),
        children: categories
          .filter((c: any) => c.parent_id === root.id)
          .map((child: any) => ({
            ...child,
            product_count: parseInt(child.product_count),
          })),
      }));

      res.status(200).json({
        success: true,
        data: { categories: tree },
      });
    } catch (error) {
      next(error);
    }
  }
}
