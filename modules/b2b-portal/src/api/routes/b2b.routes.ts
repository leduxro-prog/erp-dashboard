import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { B2BController } from '../controllers/B2BController';
import { B2BOrderController } from '../controllers/B2BOrderController';
import { B2BCartController } from '../controllers/B2BCartController';
import { B2BCheckoutController } from '../controllers/B2BCheckoutController';
import { B2BInvoiceController } from '../controllers/B2BInvoiceController';
import { B2BCustomerController } from '../controllers/B2BCustomerController';
import { B2BPaymentController } from '../controllers/B2BPaymentController';
import { B2BFavoritesController } from '../controllers/B2BFavoritesController';
import { B2BPortalWebhookController } from '../controllers/B2BPortalWebhookController';
import { B2BPortalSyncController } from '../controllers/B2BPortalSyncController';
import { authenticate, requireRole, AuthenticatedRequest } from '@shared/middleware/auth.middleware';
import { authenticateB2B } from '@shared/middleware/b2b-auth.middleware';
import { asyncHandler } from '@shared/middleware/async-handler';
import {
  validationMiddleware,
  queryValidationMiddleware,
  registerB2BCustomerSchema,
  listRegistrationsSchema,
  reviewRegistrationSchema,
  listCustomersSchema,
  adjustCreditLimitSchema,
  createSavedCartSchema,
  listSavedCartsSchema,
  convertCartToOrderSchema,
  createBulkOrderSchema,
  listBulkOrdersSchema,
} from '../validators/b2b.validators';
import {
  createB2BOrderSchema,
  validateStockSchema,
  saveCustomerAddressSchema,
} from '../validators/b2b-checkout.validators';
import {
  addFavoriteSchema,
  addAllToCartSchema,
} from '../validators/b2b-favorites.validators';

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
    const allowedExts = ['.csv'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

export function createB2BRoutes(
  controller: B2BController,
  orderController: B2BOrderController,
  cartController: B2BCartController,
  checkoutController: B2BCheckoutController,
  invoiceController?: B2BInvoiceController,
  customerController?: B2BCustomerController,
  paymentController?: B2BPaymentController,
  favoritesController?: B2BFavoritesController,
  webhookController?: B2BPortalWebhookController,
  syncController?: B2BPortalSyncController
): Router {
  const router = Router();

  /**
   * POST /register
   * Register a new B2B customer (public endpoint)
   */
  router.post(
    '/register',
    validationMiddleware(registerB2BCustomerSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.registerB2BCustomer(req, res, next),
    ),
  );

  /**
   * POST /verify-cui
   * Verify CUI with ANAF API (public endpoint)
   */
  router.post(
    '/verify-cui',
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.verifyCui(req, res, next),
    ),
  );

  /**
   * GET /verify-cui/:cui
   * Verify CUI with ANAF API via GET (public endpoint)
   */
  router.get(
    '/verify-cui/:cui',
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.verifyCuiGet(req, res, next),
    ),
  );

  /**
   * GET /products
   * List products for B2B catalog (public endpoint)
   */
  router.get(
    '/products',
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.listProducts(req, res, next),
    ),
  );

  /**
   * GET /products/filters
   * Get available filter options for products (public endpoint)
   * MUST be registered BEFORE /products/:id to avoid route conflict
   */
  router.get(
    '/products/filters',
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getProductFilters(req, res, next),
    ),
  );

  /**
   * GET /products/categories
   * Get product categories tree (public endpoint)
   * MUST be registered BEFORE /products/:id to avoid route conflict
   */
  router.get(
    '/products/categories',
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getProductCategories(req, res, next),
    ),
  );

  /**
   * GET /products/:id
   * Get product details for B2B catalog (public endpoint)
   * Uses numeric guard to prevent matching non-numeric strings like "filters" or "categories"
   */
  router.get(
    '/products/:id(\\d+)',
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getProductDetails(req, res, next),
    ),
  );

  /**
   * GET /registrations
   * List B2B registrations (admin only)
   */
  router.get(
    '/registrations',
    authenticate,
    requireRole(['admin']),
    queryValidationMiddleware(listRegistrationsSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.listRegistrations(req, res, next),
    ),
  );

  /**
   * GET /registrations/:id
   * Get B2B registration details (admin only)
   */
  router.get(
    '/registrations/:id',
    authenticate,
    requireRole(['admin']),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getRegistrationDetails(req, res, next),
    ),
  );

  /**
   * PUT /registrations/:id/review
   * Review B2B registration - approve or reject (admin only)
   */
  router.put(
    '/registrations/:id/review',
    authenticate,
    requireRole(['admin']),
    validationMiddleware(reviewRegistrationSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.reviewRegistration(req, res, next),
    ),
  );

  /**
   * GET /customers
   * List B2B customers
   */
  router.get(
    '/customers',
    authenticate,
    queryValidationMiddleware(listCustomersSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.listCustomers(req, res, next),
    ),
  );

  /**
   * GET /customers/:id
   * Get B2B customer details
   */
  router.get(
    '/customers/:id',
    authenticate,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.getCustomerDetails(req, res, next),
    ),
  );

  /**
   * PUT /customers/:id/credit
   * Adjust customer credit limit (admin only)
   */
  router.put(
    '/customers/:id/credit',
    authenticate,
    requireRole(['admin']),
    validationMiddleware(adjustCreditLimitSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.adjustCreditLimit(req, res, next),
    ),
  );

  /**
   * POST /carts
   * Create a saved cart
   */
  router.post(
    '/carts',
    authenticateB2B,
    validationMiddleware(createSavedCartSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.createSavedCart(req, res, next),
    ),
  );

  /**
   * GET /carts
   * List saved carts
   */
  router.get(
    '/carts',
    authenticateB2B,
    queryValidationMiddleware(listSavedCartsSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.listSavedCarts(req, res, next),
    ),
  );

  /**
   * POST /carts/:id/convert
   * Convert saved cart to order
   */
  router.post(
    '/carts/:id/convert',
    authenticateB2B,
    validationMiddleware(convertCartToOrderSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      orderController.createOrder(req, res, next),
    ),
  );

  /**
   * POST /orders
   * Create new order directly (for B2B store checkout)
   */
  router.post(
    '/orders',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      orderController.createOrder(req, res, next),
    ),
  );

  /**
   * GET /orders
   * Get order history
   */
  router.get(
    '/orders',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      orderController.getOrders(req, res, next),
    ),
  );

  /**
   * GET /orders/:id
   * Get order details
   */
  router.get(
    '/orders/:id',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      orderController.getOrderDetails(req, res, next),
    ),
  );

  /**
   * POST /orders/reorder/:id
   * Reorder from previous order
   */
  router.post(
    '/orders/reorder/:id',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      orderController.reorder(req, res, next),
    ),
  );

  /**
   * DELETE /orders/:id
   * Cancel an order
   */
  router.delete(
    '/orders/:id',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      orderController.cancelOrder(req, res, next),
    ),
  );

  /**
   * POST /orders/import-csv
   * Import products from CSV file for order creation
   */
  router.post(
    '/orders/import-csv',
    authenticateB2B,
    csvUpload.single('file'),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      orderController.importCSV(req, res, next),
    ),
  );

  /**
   * POST /orders/import-csv/add-to-cart
   * Add imported CSV items to cart
   */
  router.post(
    '/orders/import-csv/add-to-cart',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      orderController.importCSVAddToCart(req, res, next),
    ),
  );

  /**
   * GET /credit
   * Get customer credit info
   */
  router.get(
    '/credit',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      orderController.getCustomerCredit(req, res, next),
    ),
  );

  /**
   * POST /bulk-orders
   * Create bulk order
   */
  router.post(
    '/bulk-orders',
    authenticateB2B,
    validationMiddleware(createBulkOrderSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.createBulkOrder(req, res, next),
    ),
  );

  /**
   * GET /bulk-orders
   * List bulk orders
   */
  router.get(
    '/bulk-orders',
    authenticateB2B,
    queryValidationMiddleware(listBulkOrdersSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      controller.listBulkOrders(req, res, next),
    ),
  );

  /**
   * GET /cart
   * Get active session cart with tier pricing
   */
  router.get(
    '/cart',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      cartController.getCart(req, res, next),
    ),
  );

  /**
   * GET /cart/:customerId
   * Get cart by customer ID (admin/sales rep)
   */
  router.get(
    '/cart/:customerId',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      cartController.getCart(req, res, next),
    ),
  );

  /**
   * POST /cart/item
   * Add item to cart
   */
  router.post(
    '/cart/item',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      cartController.addToCart(req, res, next),
    ),
  );

  /**
   * POST /cart/add
   * Add item to cart (alias)
   */
  router.post(
    '/cart/add',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      cartController.addToCart(req, res, next),
    ),
  );

  /**
   * PUT /cart/item/:item_id
   * Update cart item quantity
   */
  router.put(
    '/cart/item/:item_id',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      cartController.updateCartItem(req, res, next),
    ),
  );

  /**
   * PUT /cart/item/:itemId
   * Update cart item quantity (alias with consistent naming)
   */
  router.put(
    '/cart/item/:itemId',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      cartController.updateCartItem(req, res, next),
    ),
  );

  /**
   * DELETE /cart/item/:item_id
   * Remove item from cart
   */
  router.delete(
    '/cart/item/:item_id',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      cartController.removeCartItem(req, res, next),
    ),
  );

  /**
   * DELETE /cart/item/:itemId
   * Remove item from cart (alias with consistent naming)
   */
  router.delete(
    '/cart/item/:itemId',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      cartController.removeCartItem(req, res, next),
    ),
  );

  /**
   * DELETE /cart/clear
   * Clear all items from cart
   */
  router.delete(
    '/cart/clear',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      cartController.clearCart(req, res, next),
    ),
  );

  /**
   * DELETE /cart/clear/:customerId
   * Clear cart by customer ID (admin/sales rep)
   */
  router.delete(
    '/cart/clear/:customerId',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      cartController.clearCart(req, res, next),
    ),
  );

  /**
   * GET /cart/validate-stock
   * Validate stock for all cart items
   */
  router.get(
    '/cart/validate-stock',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      cartController.validateStock(req, res, next),
    ),
  );

  /**
   * GET /checkout/profile
   * Get B2B customer profile with credit info
   */
  router.get(
    '/checkout/profile',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      checkoutController.getCustomerProfile(req, res, next),
    ),
  );

  /**
   * POST /checkout/validate-stock
   * Validate stock for checkout items
   */
  router.post(
    '/checkout/validate-stock',
    authenticateB2B,
    validationMiddleware(validateStockSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      checkoutController.validateStock(req, res, next),
    ),
  );

  /**
   * POST /checkout/validate-credit
   * Validate customer credit for order amount
   */
  router.post(
    '/checkout/validate-credit',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      checkoutController.validateCredit(req, res, next),
    ),
  );

  /**
   * GET /checkout/addresses
   * Get saved addresses for customer
   */
  router.get(
    '/checkout/addresses',
    authenticateB2B,
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      checkoutController.getCustomerAddresses(req, res, next),
    ),
  );

  /**
   * POST /checkout/addresses
   * Save a new address for customer
   */
  router.post(
    '/checkout/addresses',
    authenticateB2B,
    validationMiddleware(saveCustomerAddressSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      checkoutController.saveCustomerAddress(req, res, next),
    ),
  );

  /**
   * POST /checkout
   * Process B2B checkout (create order)
   */
  router.post(
    '/checkout',
    authenticateB2B,
    validationMiddleware(createB2BOrderSchema),
    asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
      checkoutController.processCheckout(req, res, next),
    ),
  );

  if (customerController) {
    /**
     * GET /profile
     * Get B2B customer profile
     */
    router.get(
      '/profile',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        customerController.getProfile(req, res, next),
      ),
    );

    /**
     * PUT /profile
     * Update B2B customer profile
     */
    router.put(
      '/profile',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        customerController.updateProfile(req, res, next),
      ),
    );

    /**
     * GET /addresses
     * Get customer addresses
     */
    router.get(
      '/addresses',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        customerController.getAddresses(req, res, next),
      ),
    );

    /**
     * POST /addresses
     * Add new address
     */
    router.post(
      '/addresses',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        customerController.addAddress(req, res, next),
      ),
    );

    /**
     * PUT /addresses/:id
     * Update address
     */
    router.put(
      '/addresses/:id',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        customerController.updateAddress(req, res, next),
      ),
    );

    /**
     * DELETE /addresses/:id
     * Delete address
     */
    router.delete(
      '/addresses/:id',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        customerController.deleteAddress(req, res, next),
      ),
    );

    /**
     * PUT /addresses/:id/default
     * Set default address
     */
    router.put(
      '/addresses/:id/default',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        customerController.setDefaultAddress(req, res, next),
      ),
    );
  }

  if (invoiceController) {
    router.get(
      '/invoices',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        invoiceController.getInvoices(req, res, next),
      ),
    );

    router.get(
      '/invoices/:id',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        invoiceController.getInvoiceDetails(req, res, next),
      ),
    );

    router.get(
      '/invoices/:orderId/download',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        invoiceController.downloadInvoice(req, res, next),
      ),
    );

    router.get(
      '/invoices/:orderId/preview',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        invoiceController.previewInvoice(req, res, next),
      ),
    );
  }

  if (paymentController) {
    router.get(
      '/payments',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        paymentController.getPayments(req, res, next),
      ),
    );

    router.get(
      '/payments/summary',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        paymentController.getPaymentSummary(req, res, next),
      ),
    );
  }

  if (favoritesController) {
    router.get(
      '/favorites',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        favoritesController.getFavorites(req, res, next),
      ),
    );

    router.post(
      '/favorites',
      authenticateB2B,
      validationMiddleware(addFavoriteSchema),
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        favoritesController.addFavorite(req, res, next),
      ),
    );

    router.delete(
      '/favorites/:productId',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        favoritesController.removeFavorite(req, res, next),
      ),
    );

    router.get(
      '/favorites/check/:productId',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        favoritesController.checkFavorite(req, res, next),
      ),
    );

    router.post(
      '/favorites/add-all-to-cart',
      authenticateB2B,
      validationMiddleware(addAllToCartSchema),
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        favoritesController.addAllToCart(req, res, next),
      ),
    );

    router.post(
      '/favorites/:productId/notify-stock',
      authenticateB2B,
      asyncHandler((req: AuthenticatedRequest, res: Response, next: NextFunction) =>
        favoritesController.notifyStockBack(req, res, next),
      ),
    );
  }

  // B2B Portal Webhook Routes
  if (webhookController) {
    /**
     * POST /webhooks/b2b/order
     * Handle order status update webhook from B2B Portal
     */
    router.post(
      '/webhooks/b2b/order',
      asyncHandler((req: Request, res: Response, next: NextFunction) =>
        webhookController.handleOrderWebhook(req, res, next),
      ),
    );

    /**
     * POST /webhooks/b2b/invoice
     * Handle invoice status update webhook from B2B Portal
     */
    router.post(
      '/webhooks/b2b/invoice',
      asyncHandler((req: Request, res: Response, next: NextFunction) =>
        webhookController.handleInvoiceWebhook(req, res, next),
      ),
    );

    /**
     * POST /webhooks/b2b
     * Handle generic webhook from B2B Portal
     */
    router.post(
      '/webhooks/b2b',
      asyncHandler((req: Request, res: Response, next: NextFunction) =>
        webhookController.handleGenericWebhook(req, res, next),
      ),
    );

    /**
     * GET /webhooks/b2b/verify
     * Verify B2B Portal webhook endpoint
     */
    router.get(
      '/webhooks/b2b/verify',
      asyncHandler((req: Request, res: Response, next: NextFunction) =>
        webhookController.verifyWebhook(req, res, next),
      ),
    );
  }

  // B2B Portal Sync Routes (admin only)
  if (syncController) {
    /**
     * GET /sync/orders/:id
     * Get sync status for an order
     */
    router.get(
      '/sync/orders/:id',
      authenticate,
      requireRole(['admin']),
      asyncHandler((req: Request, res: Response, next: NextFunction) =>
        syncController.getOrderSyncStatus(req, res, next),
      ),
    );

    /**
     * GET /sync/invoices/:id
     * Get sync status for an invoice
     */
    router.get(
      '/sync/invoices/:id',
      authenticate,
      requireRole(['admin']),
      asyncHandler((req: Request, res: Response, next: NextFunction) =>
        syncController.getInvoiceSyncStatus(req, res, next),
      ),
    );

    /**
     * GET /sync/pending
     * Get all pending sync events
     */
    router.get(
      '/sync/pending',
      authenticate,
      requireRole(['admin']),
      asyncHandler((req: Request, res: Response, next: NextFunction) =>
        syncController.getPendingSyncEvents(req, res, next),
      ),
    );

    /**
     * GET /sync/statistics
     * Get sync statistics
     */
    router.get(
      '/sync/statistics',
      authenticate,
      requireRole(['admin']),
      asyncHandler((req: Request, res: Response, next: NextFunction) =>
        syncController.getSyncStatistics(req, res, next),
      ),
    );

    /**
     * POST /sync/orders/:id/sync
     * Trigger manual sync for an order
     */
    router.post(
      '/sync/orders/:id/sync',
      authenticate,
      requireRole(['admin']),
      asyncHandler((req: Request, res: Response, next: NextFunction) =>
        syncController.syncOrder(req, res, next),
      ),
    );

    /**
     * POST /sync/invoices/:id/sync
     * Trigger manual sync for an invoice
     */
    router.post(
      '/sync/invoices/:id/sync',
      authenticate,
      requireRole(['admin']),
      asyncHandler((req: Request, res: Response, next: NextFunction) =>
        syncController.syncInvoice(req, res, next),
      ),
    );
  }

  return router;
}
