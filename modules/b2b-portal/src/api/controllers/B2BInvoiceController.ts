import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { DataSource } from 'typeorm';
import {
  PdfInvoiceService,
  InvoiceData,
  InvoiceItem,
  InvoiceCompanyData,
  InvoiceCustomerData,
} from '../../infrastructure/services/PdfInvoiceService';
import { VAT_RATE } from '@shared/constants';
import * as fs from 'fs';
import * as path from 'path';

export interface InvoiceListItem {
  id: string;
  invoice_number: string;
  order_id: string;
  order_number: string;
  issue_date: Date;
  due_date: Date;
  subtotal: number;
  vat_amount: number;
  total: number;
  currency: string;
  status: 'draft' | 'issued' | 'sent' | 'paid' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid';
  smartbill_id?: string;
  created_at: Date;
}

export interface InvoiceDetail extends InvoiceListItem {
  customer: {
    id: string;
    company_name: string;
    cui: string;
    address: string;
    contact_name?: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    product_id: string;
    sku: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    total_price: number;
    vat_rate: number;
    vat_amount: number;
  }>;
  order: {
    id: string;
    order_number: string;
    shipping_address: string;
    billing_address: string;
    payment_method: string;
    notes?: string;
  };
}

export class B2BInvoiceController {
  private pdfService: PdfInvoiceService;

  constructor(private readonly dataSource: DataSource) {
    this.pdfService = new PdfInvoiceService();
  }

  async getInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, status, payment_status } = req.query as Record<string, any>;
      const offset = (Number(page) - 1) * Number(limit);

      const b2bCustomer = (req as any).b2bCustomer;
      const customerId =
        b2bCustomer?.customer_id ?? b2bCustomer?.id ?? (req.user as any)?.b2bCustomerId;
      const isAdmin = req.user?.role === 'admin';

      if (!isAdmin && !customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      let whereClause = isAdmin ? 'WHERE 1=1' : 'WHERE o.customer_id = $1';
      const params: any[] = isAdmin ? [] : [customerId];
      let paramIndex = isAdmin ? 1 : 2;

      if (status) {
        whereClause += ` AND COALESCE(o.status, 'issued') = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (payment_status) {
        whereClause += ` AND COALESCE(o.payment_status, 'unpaid') = $${paramIndex}`;
        params.push(payment_status);
        paramIndex++;
      }

      params.push(Number(limit), offset);

      const invoices = await this.dataSource.query(
        `SELECT 
          CONCAT('inv_', o.id) as id,
          CONCAT('INV-', TO_CHAR(o.created_at, 'YYYYMM'), '-', LPAD(o.id::TEXT, 5, '0')) as invoice_number,
          o.id as order_id,
          o.order_number,
          o.created_at as issue_date,
          o.payment_due_date as due_date,
          COALESCE(o.subtotal - o.vat_amount, o.subtotal) as subtotal,
          o.vat_amount,
          o.total,
          COALESCE(o.currency_code, 'RON') as currency,
          LOWER(o.status) as status,
          COALESCE(o.payment_status, 'unpaid') as payment_status,
          o.smartbill_id,
          o.created_at,
          c.company_name,
          c.cui
         FROM b2b_orders o
         LEFT JOIN b2b_customers c ON o.customer_id = c.id
         ${whereClause}
         ORDER BY o.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params,
      );

      const countWhereClause = isAdmin ? 'WHERE 1=1' : 'WHERE o.customer_id = $1';
      const countParams: any[] = isAdmin ? [] : [customerId];
      let countParamIdx = isAdmin ? 1 : 2;

      let countQuery = `SELECT COUNT(DISTINCT o.id) as total FROM b2b_orders o ${countWhereClause}`;

      if (status) {
        countQuery += ` AND COALESCE(o.status, 'issued') = $${countParamIdx}`;
        countParams.push(status);
        countParamIdx++;
      }

      if (payment_status) {
        countQuery += ` AND COALESCE(o.payment_status, 'unpaid') = $${countParamIdx}`;
        countParams.push(payment_status);
        countParamIdx++;
      }

      const totalResult = await this.dataSource.query(countQuery, countParams);
      const total = parseInt(totalResult[0]?.total || '0', 10);

      const invoiceList: InvoiceListItem[] = invoices.map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        order_id: inv.order_id,
        order_number: inv.order_number,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        subtotal: parseFloat(inv.subtotal) || 0,
        vat_amount: parseFloat(inv.vat_amount) || 0,
        total: parseFloat(inv.total) || 0,
        currency: inv.currency || 'RON',
        status: inv.status || 'issued',
        payment_status: inv.payment_status || 'unpaid',
        smartbill_id: inv.smartbill_id,
        created_at: inv.created_at,
      }));

      res.status(200).json({
        success: true,
        data: {
          invoices: invoiceList,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            total_pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      next(error);
    }
  }

  async getInvoiceDetails(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;
      const b2bCustomer = (req as any).b2bCustomer;
      const customerId =
        b2bCustomer?.customer_id ?? b2bCustomer?.id ?? (req.user as any)?.b2bCustomerId;
      const isAdmin = req.user?.role === 'admin';

      if (!isAdmin && !customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const orderId = id.startsWith('inv_') ? id.replace('inv_', '') : id;

      let orderQuery = `
        SELECT 
          o.*,
          c.id as customer_id,
          c.company_name,
          c.cui,
          c.address,
          c.phone,
          o.invoice_number as inv_invoice_number,
          o.created_at as issue_date,
          o.payment_due_date as inv_due_date,
          LOWER(o.status) as invoice_status,
          COALESCE(o.payment_status, 'unpaid') as inv_payment_status,
          o.smartbill_id
        FROM b2b_orders o
        LEFT JOIN b2b_customers c ON o.customer_id = c.id
        WHERE o.id = $1
      `;
      const params: any[] = [orderId];

      if (!isAdmin && customerId) {
        orderQuery += ' AND o.customer_id = $2';
        params.push(customerId);
      }

      const orderResult = await this.dataSource.query(orderQuery, params);

      if (orderResult.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
        });
        return;
      }

      const order = orderResult[0];

      const items = await this.dataSource.query(
        `SELECT 
          oi.id,
          oi.product_id,
          oi.sku,
          oi.product_name,
           oi.quantity,
           oi.unit_price,
           oi.discount_percent,
           oi.total_price,
           ${VAT_RATE * 100} as vat_rate,
           ROUND(oi.total_price * ${VAT_RATE}, 2) as vat_amount
         FROM b2b_order_items oi
         WHERE oi.order_id = $1
         ORDER BY oi.id`,
        [order.id],
      );

      const invoiceDetail: InvoiceDetail = {
        id: `inv_${order.id}`,
        invoice_number:
          order.inv_invoice_number ||
          order.invoice_number ||
          `INV-${new Date(order.created_at).getFullYear()}${String(new Date(order.created_at).getMonth() + 1).padStart(2, '0')}-${String(order.id).padStart(5, '0')}`,
        order_id: order.id,
        order_number: order.order_number,
        issue_date: order.issue_date || order.created_at,
        due_date: order.inv_due_date || order.payment_due_date,
        subtotal: parseFloat(order.subtotal) || 0,
        vat_amount: parseFloat(order.vat_amount) || 0,
        total: parseFloat(order.total) || 0,
        currency: order.currency_code || 'RON',
        status: order.invoice_status || 'issued',
        payment_status: order.inv_payment_status || order.payment_status || 'unpaid',
        smartbill_id: order.smartbill_id,
        created_at: order.created_at,
        customer: {
          id: order.customer_id,
          company_name: order.company_name,
          cui: order.cui,
          address: order.billing_address || order.shipping_address || order.address || '',
          contact_name: order.contact_name,
          phone: order.contact_phone || order.phone,
        },
        items: items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          sku: item.sku,
          product_name: item.product_name,
          quantity: parseInt(item.quantity) || 1,
          unit_price: parseFloat(item.unit_price) || 0,
          discount_percent: parseFloat(item.discount_percent) || 0,
          total_price: parseFloat(item.total_price) || 0,
          vat_rate: parseFloat(item.vat_rate) || VAT_RATE * 100,
          vat_amount: parseFloat(item.vat_amount) || 0,
        })),
        order: {
          id: order.id,
          order_number: order.order_number,
          shipping_address: order.shipping_address,
          billing_address: order.billing_address,
          payment_method: order.payment_method,
          notes: order.notes,
        },
      };

      res.status(200).json({
        success: true,
        data: invoiceDetail,
      });
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      next(error);
    }
  }

  async downloadInvoice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { orderId } = req.params;
      const b2bCustomer = (req as any).b2bCustomer;
      const customerId =
        b2bCustomer?.customer_id ?? b2bCustomer?.id ?? (req.user as any)?.b2bCustomerId;
      const isAdmin = req.user?.role === 'admin';

      if (!isAdmin && !customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const orderResult = await this.getOrderWithCustomer(orderId, customerId, isAdmin);

      if (!orderResult) {
        res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
        });
        return;
      }

      const { order, customer, items } = orderResult;

      const invoiceNumber = await this.generateInvoiceNumber(order.id, order);
      const invoiceData = await this.buildInvoiceData(order, customer, items, invoiceNumber);

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await this.pdfService.generateInvoicePdf(invoiceData);
      } catch (pdfError) {
        console.error('PDF generation failed for invoice:', invoiceNumber, pdfError);
        res.status(500).json({
          success: false,
          error: {
            code: 'PDF_GENERATION_FAILED',
            message: 'Failed to generate invoice PDF. Please try again later.',
          },
        });
        return;
      }

      const filename = `Factura_${invoiceNumber}_${customer.company_name.replace(/\s+/g, '_')}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(filename)}"`,
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      next(error);
    }
  }

  async previewInvoice(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { orderId } = req.params;
      const b2bCustomer = (req as any).b2bCustomer;
      const customerId =
        b2bCustomer?.customer_id ?? b2bCustomer?.id ?? (req.user as any)?.b2bCustomerId;
      const isAdmin = req.user?.role === 'admin';

      if (!isAdmin && !customerId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const orderResult = await this.getOrderWithCustomer(orderId, customerId, isAdmin);

      if (!orderResult) {
        res.status(404).json({
          success: false,
          error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' },
        });
        return;
      }

      const { order, customer, items } = orderResult;

      const invoiceNumber = await this.generateInvoiceNumber(order.id, order);
      const invoiceData = await this.buildInvoiceData(order, customer, items, invoiceNumber);

      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await this.pdfService.generateInvoicePdf(invoiceData);
      } catch (pdfError) {
        console.error('PDF preview generation failed for invoice:', invoiceNumber, pdfError);
        res.status(500).json({
          success: false,
          error: {
            code: 'PDF_GENERATION_FAILED',
            message: 'Failed to generate invoice PDF preview. Please try again later.',
          },
        });
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Factura_${invoiceNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error previewing invoice PDF:', error);
      next(error);
    }
  }

  private async getOrderWithCustomer(
    orderId: string,
    customerId: string | undefined,
    isAdmin: boolean,
  ) {
    let orderQuery = `
      SELECT 
        o.id,
        o.order_number,
        o.customer_id,
        o.status,
        o.total,
        o.subtotal,
        o.vat_amount,
        o.discount_amount,
        o.shipping_address,
        o.billing_address,
        o.contact_name,
        o.contact_phone,
        o.payment_due_date,
        o.payment_method,
        o.created_at,
        o.notes,
        o.invoice_number as stored_invoice_number
      FROM b2b_orders o
      WHERE o.id = $1
    `;
    const params: any[] = [orderId];

    if (!isAdmin && customerId) {
      orderQuery += ' AND o.customer_id = $2';
      params.push(customerId);
    }

    const orderResult = await this.dataSource.query(orderQuery, params);

    if (orderResult.length === 0) {
      return null;
    }

    const order = orderResult[0];

    const customerResult = await this.dataSource.query(
      `SELECT 
        id,
        company_name,
        cui,
        tier,
        payment_terms_days
      FROM b2b_customers
      WHERE id = $1`,
      [order.customer_id],
    );

    if (customerResult.length === 0) {
      return null;
    }

    const customer = customerResult[0];

    const items = await this.dataSource.query(
      `SELECT 
        oi.product_id,
        oi.sku,
        oi.product_name,
        oi.quantity,
        oi.unit_price,
        oi.discount_percent,
        oi.total_price
      FROM b2b_order_items oi
      WHERE oi.order_id = $1
      ORDER BY oi.id`,
      [orderId],
    );

    return { order, customer, items };
  }

  private async generateInvoiceNumber(orderId: string, order: any): Promise<string> {
    if (order.stored_invoice_number) {
      return order.stored_invoice_number;
    }

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const invoiceNumber = `INV-${year}${month}-${String(orderId).padStart(5, '0')}`;

    try {
      await this.dataSource.query(
        `UPDATE b2b_orders SET invoice_number = $1, invoice_generated_at = NOW() WHERE id = $2`,
        [invoiceNumber, orderId],
      );
    } catch (e) {
      console.log('Could not save invoice number to order:', e);
    }

    return invoiceNumber;
  }

  private async buildInvoiceData(
    order: any,
    customer: any,
    items: any[],
    invoiceNumber: string,
  ): Promise<InvoiceData> {
    const settings = this.loadSettings();

    const company: InvoiceCompanyData = {
      name: settings?.general?.companyName || this.pdfService.getCompanyData().name,
      cui: settings?.general?.taxId || this.pdfService.getCompanyData().cui,
      address: settings?.general?.address || this.pdfService.getCompanyData().address,
      phone: settings?.general?.phone || this.pdfService.getCompanyData().phone,
      email: settings?.general?.email || this.pdfService.getCompanyData().email,
      iban: settings?.general?.iban || this.pdfService.getCompanyData().iban,
      bank: settings?.general?.bank || this.pdfService.getCompanyData().bank,
    };

    const billingAddress = order.billing_address || order.shipping_address || '';

    const invoiceCustomer: InvoiceCustomerData = {
      companyName: customer.company_name,
      cui: customer.cui,
      address: billingAddress,
      contactName: order.contact_name,
      phone: order.contact_phone,
    };

    const invoiceItems: InvoiceItem[] = items.map((item, index) => {
      const unitPrice = parseFloat(item.unit_price) || 0;
      const quantity = parseInt(item.quantity) || 1;
      const totalPrice = parseFloat(item.total_price) || unitPrice * quantity;
      const discountPercent = parseFloat(item.discount_percent) || 0;
      const basePrice = discountPercent > 0 ? unitPrice / (1 - discountPercent / 100) : unitPrice;

      const totalBeforeVat = totalPrice;
      const vatAmount = totalBeforeVat * VAT_RATE;

      return {
        sku: item.sku || `PROD-${index + 1}`,
        name: item.product_name || 'Produs',
        quantity,
        unitPrice: basePrice,
        discount: discountPercent / 100,
        unitPriceAfterDiscount: unitPrice,
        total: totalBeforeVat,
        vatRate: VAT_RATE * 100,
        vatAmount,
      };
    });

    const subtotal =
      parseFloat(order.subtotal) || invoiceItems.reduce((sum, item) => sum + item.total, 0);
    const totalDiscount = parseFloat(order.discount_amount) || 0;
    const totalVat = parseFloat(order.vat_amount) || subtotal * VAT_RATE;
    const totalToPay = parseFloat(order.total) || subtotal + totalVat;

    const dueDate = order.payment_due_date
      ? new Date(order.payment_due_date)
      : new Date(Date.now() + (customer.payment_terms_days || 30) * 24 * 60 * 60 * 1000);

    return {
      invoiceNumber,
      invoiceDate: new Date(),
      dueDate,
      orderNumber: order.order_number,
      company,
      customer: invoiceCustomer,
      items: invoiceItems,
      subtotal,
      totalDiscount,
      totalBeforeVat: subtotal,
      totalVat,
      totalToPay,
      paymentTerms: customer.payment_terms_days || 30,
      notes: order.notes,
    };
  }

  private loadSettings(): any {
    try {
      const settingsPath = path.join(process.cwd(), 'config', 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const content = fs.readFileSync(settingsPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
    return null;
  }
}
