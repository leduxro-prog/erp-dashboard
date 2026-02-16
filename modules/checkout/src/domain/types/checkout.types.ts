/**
 * Checkout Domain Types
 *
 * Common types used across the checkout module.
 */

import { CreditReservationStatus } from '../entities/CreditReservationEntity';
import { CartStatus } from '../entities/CartEntity';
import { OrderStatus, PaymentStatus } from '@modules/orders/src/infrastructure/entities/OrderEntity';

/**
 * Credit reservation result
 */
export interface CreditReservationResult {
  success: boolean;
  reservationId?: string;
  availableCredit?: number;
  reservedAmount?: number;
  error?: string;
}

/**
 * Order creation result
 */
export interface OrderCreationResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

/**
 * Credit capture result
 */
export interface CreditCaptureResult {
  success: boolean;
  transactionId?: string;
  capturedAmount?: number;
  remainingCredit?: number;
  error?: string;
}

/**
 * Credit release result
 */
export interface CreditReleaseResult {
  success: boolean;
  releasedAmount?: number;
  availableCredit?: number;
  error?: string;
}

/**
 * Checkout flow result
 */
export interface CheckoutFlowResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  reservationId?: string;
  transactionId?: string;
  error?: string;
  steps?: CheckoutStep[];
}

/**
 * Checkout step result
 */
export interface CheckoutStep {
  name: CheckoutStepName;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
  compensation?: {
    executed: boolean;
    reason: string;
    executedAt?: Date;
  };
}

/**
 * Reserve credit request
 */
export interface ReserveCreditRequest {
  customerId: string;
  orderId: string;
  amount: number;
  userId?: string;
  notes?: string;
}

/**
 * Create order from cart request
 */
export interface CreateOrderFromCartRequest {
  cartId: string;
  customerId: string;
  userId?: string;
  billingAddress?: Record<string, any>;
  shippingAddress?: Record<string, any>;
  notes?: string;
}

/**
 * Capture credit request
 */
export interface CaptureCreditRequest {
  orderId: string;
  userId?: string;
  notes?: string;
}

/**
 * Release credit request
 */
export interface ReleaseCreditRequest {
  orderId: string;
  userId?: string;
  reason?: string;
}

/**
 * Rollback order request
 */
export interface RollbackOrderRequest {
  orderId: string;
  reason: string;
  userId?: string;
  releaseCredit?: boolean;
  releaseStock?: boolean;
}

/**
 * Checkout flow options
 */
export interface CheckoutFlowOptions {
  reserveCredit?: boolean;
  reserveStock?: boolean;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Transaction context
 */
export interface TransactionContext {
  transactionId: string;
  requestId?: string;
  userId?: string;
  isolationLevel?: string;
  startTime: Date;
}

/**
 * Compensation action
 */
export interface CompensationAction {
  name: string;
  execute: () => Promise<void>;
  executed: boolean;
  error?: Error;
}

/**
 * Checkout state machine
 */
export interface CheckoutState {
  status: CheckoutStatus;
  currentStep: CheckoutStepName;
  creditReservation?: {
    id: string;
    amount: number;
    status: CreditReservationStatus;
  };
  orderId?: string;
  orderStatus?: OrderStatus;
  paymentStatus?: PaymentStatus;
  stockReservation?: {
    id: string;
    items: Array<{ productId: string; quantity: number }>;
  };
  errors: CheckoutError[];
  metadata: Record<string, unknown>;
}

/**
 * Checkout status
 */
export enum CheckoutStatus {
  INITIATED = 'INITIATED',
  CREDIT_RESERVED = 'CREDIT_RESERVED',
  STOCK_RESERVED = 'STOCK_RESERVED',
  ORDER_CREATED = 'ORDER_CREATED',
  PAYMENT_CAPTURED = 'PAYMENT_CAPTURED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  ROLLING_BACK = 'ROLLING_BACK',
  ROLLED_BACK = 'ROLLED_BACK',
}

/**
 * Checkout step names
 */
export enum CheckoutStepName {
  VALIDATE_CART = 'VALIDATE_CART',
  RESERVE_CREDIT = 'RESERVE_CREDIT',
  RESERVE_STOCK = 'RESERVE_STOCK',
  CREATE_ORDER = 'CREATE_ORDER',
  CAPTURE_PAYMENT = 'CAPTURE_PAYMENT',
  FINALIZE = 'FINALIZE',
}

/**
 * Checkout error
 */
export interface CheckoutError {
  step: CheckoutStepName;
  code: string;
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * Cart validation result
 */
export interface CartValidationResult {
  valid: boolean;
  errors: Array<{
    itemIndex: number;
    code: string;
    message: string;
  }>;
  warnings: Array<{
    itemIndex: number;
    code: string;
    message: string;
  }>;
}

/**
 * Credit limit check result
 */
export interface CreditLimitCheckResult {
  withinLimit: boolean;
  availableCredit: number;
  requestedAmount: number;
  creditLimit: number;
  usedCredit: number;
}

/**
 * Stock availability check result
 */
export interface StockAvailabilityResult {
  available: boolean;
  items: Array<{
    productId: string;
    productName: string;
    requested: number;
    available: number;
    reserved: number;
    sufficient: boolean;
  }>;
}

/**
 * Transaction metrics
 */
export interface TransactionMetrics {
  transactionId: string;
  operation?: string;
  duration?: number;
  steps: number;
  successfulSteps: number;
  failedSteps: number;
  retried: boolean;
  retryCount: number;
  savepoints: number;
  compensations: number;
}
