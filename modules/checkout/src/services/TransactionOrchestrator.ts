/**
 * Transaction Orchestrator
 *
 * Orchestrates complex checkout flow with:
 * - executeCheckoutFlow(cartId) - Complete checkout with transactions
 * - Handle failures at each step
 * - Implement compensation transactions
 */

import { FinancialTransactionService } from './FinancialTransactionService';
import logger from '@shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  CheckoutFlowResult,
  CheckoutStep,
  CheckoutFlowOptions,
  CheckoutStepName,
  CompensationAction,
  CheckoutStatus,
  TransactionContext,
} from '../domain/types/checkout.types';
import { CartEntity } from '../domain/entities/CartEntity';

/**
 * Checkout flow state
 */
interface CheckoutFlowState {
  flowId: string;
  cartId: string;
  customerId: string;
  status: CheckoutStatus;
  steps: Map<CheckoutStepName, CheckoutStep>;
  compensations: CompensationAction[];
  context: TransactionContext;
  metadata: Record<string, unknown>;
}

/**
 * Orchestrator configuration
 */
export interface TransactionOrchestratorConfig {
  financialTransactionService: FinancialTransactionService;
  enableCompensation?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Transaction Orchestrator
 *
 * Manages complex multi-step transaction flows with compensation
 */
export class TransactionOrchestrator {
  private readonly financialTransactionService: FinancialTransactionService;
  private readonly enableCompensation: boolean;
  private readonly enableRetry: boolean;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;

  constructor(config: TransactionOrchestratorConfig) {
    this.financialTransactionService = config.financialTransactionService;
    this.enableCompensation = config.enableCompensation ?? true;
    this.enableRetry = config.enableRetry ?? true;
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 30000;
  }

  /**
   * Execute complete checkout flow
   *
   * Flow steps:
   * 1. Validate cart and reserve credit
   * 2. Reserve stock (optional)
   * 3. Create order
   * 4. Capture credit/payment
   * 5. Finalize
   *
   * Each step is wrapped in its own transaction for proper isolation.
   * On failure, compensation actions are executed to rollback state.
   *
   * @param cartId - Cart ID to checkout
   * @param customerId - Customer ID
   * @param options - Checkout flow options
   * @returns Checkout flow result
   */
  async executeCheckoutFlow(
    cartId: string,
    customerId: string,
    options: CheckoutFlowOptions = {}
  ): Promise<CheckoutFlowResult> {
    const flowId = uuidv4();
    const startTime = new Date();

    // Initialize flow state
    const state: CheckoutFlowState = {
      flowId,
      cartId,
      customerId,
      status: CheckoutStatus.INITIATED,
      steps: new Map(),
      compensations: [],
      context: {
        transactionId: `flow_${flowId}`,
        startTime,
        ...options.metadata,
      },
      metadata: { ...options },
    };

    logger.info('Starting checkout flow', {
      flowId,
      cartId,
      customerId,
      options,
    });

    try {
      // Step 1: Validate Cart
      state.status = CheckoutStatus.INITIATED;
      await this.executeStep(
        state,
        CheckoutStepName.VALIDATE_CART,
        async () => this.validateCart(cartId, customerId)
      );

      // Step 2: Reserve Credit (if enabled)
      let reservationId: string | undefined;
      if (options.reserveCredit !== false) {
        state.status = CheckoutStatus.CREDIT_RESERVED;
        const reserveCreditResult = await this.executeStep(
          state,
          CheckoutStepName.RESERVE_CREDIT,
          async () => this.reserveCreditStep(cartId, customerId)
        );
        reservationId = reserveCreditResult.data?.reservationId;
      }

      // Step 3: Reserve Stock (if enabled)
      if (options.reserveStock !== false) {
        state.status = CheckoutStatus.STOCK_RESERVED;
        await this.executeStep(
          state,
          CheckoutStepName.RESERVE_STOCK,
          async () => this.reserveStockStep(cartId, customerId)
        );
      }

      // Step 4: Create Order
      state.status = CheckoutStatus.ORDER_CREATED;
      const orderResult = await this.executeStep(
        state,
        CheckoutStepName.CREATE_ORDER,
        async () => this.createOrderStep(cartId, customerId)
      );

      // Step 5: Capture Payment (if credit was reserved)
      let transactionId: string | undefined;
      if (options.reserveCredit !== false) {
        state.status = CheckoutStatus.PAYMENT_CAPTURED;
        const captureResult = await this.executeStep(
          state,
          CheckoutStepName.CAPTURE_PAYMENT,
          async () => this.captureCreditStep(orderResult.data!.orderId!)
        );
        transactionId = captureResult.data?.transactionId;
      }

      // Step 6: Finalize
      state.status = CheckoutStatus.COMPLETED;
      await this.executeStep(
        state,
        CheckoutStepName.FINALIZE,
        async () => this.finalizeStep(orderResult.data!.orderId!)
      );

      const duration = Date.now() - startTime.getTime();

      logger.info('Checkout flow completed successfully', {
        flowId,
        orderId: orderResult.data?.orderId,
        duration,
      });

      return {
        success: true,
        orderId: orderResult.data?.orderId,
        orderNumber: orderResult.data?.orderNumber,
        reservationId,
        transactionId,
        steps: Array.from(state.steps.values()),
      };
    } catch (error) {
      const err = error as Error;
      state.status = CheckoutStatus.FAILED;
      state.status = CheckoutStatus.ROLLING_BACK;

      logger.error('Checkout flow failed, executing compensation', {
        flowId,
        error: err.message,
        stepsFailed: Array.from(state.steps.values()).filter((s) => s.status === 'FAILED'),
      });

      // Execute compensation actions
      if (this.enableCompensation) {
        await this.executeCompensations(state);
      }

      state.status = CheckoutStatus.ROLLED_BACK;

      return {
        success: false,
        error: err.message,
        steps: Array.from(state.steps.values()),
      };
    }
  }

  /**
   * Execute a single step in the flow
   */
  private async executeStep<T>(
    state: CheckoutFlowState,
    stepName: CheckoutStepName,
    stepFn: () => Promise<{ data?: T; success: boolean; error?: string }>
  ): Promise<{ data?: T; success: boolean; error?: string }> {
    const stepStartTime = new Date();
    const step: CheckoutStep = {
      name: stepName,
      status: 'IN_PROGRESS',
      startedAt: stepStartTime,
    };

    state.steps.set(stepName, step);

    logger.info(`Executing step: ${stepName}`, {
      flowId: state.flowId,
    });

    try {
      const result = await this.executeWithRetry(
        async () => stepFn(),
        stepName
      );

      step.status = result.success ? 'COMPLETED' : 'FAILED';
      step.completedAt = new Date();
      step.duration = step.completedAt.getTime() - stepStartTime.getTime();

      if (result.error) {
        step.error = result.error;
      }

      // Register compensation if step completed successfully
      if (result.success && result.data) {
        this.registerCompensation(state, stepName, result.data);
      }

      state.steps.set(stepName, step);

      return result;
    } catch (error) {
      step.status = 'FAILED';
      step.completedAt = new Date();
      step.duration = step.completedAt.getTime() - stepStartTime.getTime();
      step.error = (error as Error).message;

      state.steps.set(stepName, step);

      throw error;
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    stepName: CheckoutStepName
  ): Promise<T> {
    if (!this.enableRetry) {
      return fn();
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRetries && this.isRetryableError(error)) {
          const backoffMs = this.calculateBackoff(attempt);
          logger.warn(`Step ${stepName} failed, retrying`, {
            attempt,
            nextAttempt: attempt + 1,
            backoffMs,
            error: lastError.message,
          });

          await this.sleep(backoffMs);
          continue;
        }

        break;
      }
    }

    throw lastError;
  }

  /**
   * Register compensation action for a completed step
   */
  private registerCompensation<T>(state: CheckoutFlowState, stepName: CheckoutStepName, data: T): void {
    switch (stepName) {
      case CheckoutStepName.RESERVE_CREDIT: {
        const reservation = data as any;
        if (reservation.reservationId) {
          state.compensations.push({
            name: 'releaseCredit',
            execute: async () => {
              await this.financialTransactionService.releaseCredit({
                orderId: reservation.orderId,
                reason: `Checkout flow compensation - ${state.flowId}`,
              });
            },
            executed: false,
          });
        }
        break;
      }

      case CheckoutStepName.RESERVE_STOCK: {
        state.compensations.push({
          name: 'releaseStock',
          execute: async () => {
            // TODO: Implement stock release
            logger.info('Stock compensation would be executed', {
              flowId: state.flowId,
            });
          },
          executed: false,
        });
        break;
      }

      case CheckoutStepName.CREATE_ORDER: {
        const order = data as any;
        if (order.orderId) {
          state.compensations.push({
            name: 'cancelOrder',
            execute: async () => {
              await this.financialTransactionService.rollbackOrder({
                orderId: order.orderId,
                reason: `Checkout flow compensation - ${state.flowId}`,
                releaseCredit: false, // Credit handled separately
                releaseStock: false, // Stock handled separately
              });
            },
            executed: false,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Execute all compensations in reverse order
   */
  private async executeCompensations(state: CheckoutFlowState): Promise<void> {
    // Execute compensations in reverse order (last in, first out)
    const reversedCompensations = [...state.compensations].reverse();

    for (const compensation of reversedCompensations) {
      if (compensation.executed) {
        continue;
      }

      try {
        logger.info(`Executing compensation: ${compensation.name}`, {
          flowId: state.flowId,
        });

        await compensation.execute();

        compensation.executed = true;

        // Update step metadata to reflect compensation
        for (const step of state.steps.values()) {
          if (step.compensation) {
            continue;
          }

          // Add compensation record to relevant step
          if (this.stepNeedsCompensation(step.name, compensation.name)) {
            step.compensation = {
              executed: true,
              reason: `Checkout flow failed: ${state.steps.get(CheckoutStepName.CREATE_ORDER)?.error}`,
              executedAt: new Date(),
            };
          }
        }

        logger.info(`Compensation executed successfully: ${compensation.name}`, {
          flowId: state.flowId,
        });
      } catch (error) {
        compensation.error = error as Error;
        logger.error(`Compensation failed: ${compensation.name}`, {
          flowId: state.flowId,
          error: (error as Error).message,
        });
        // Continue with other compensations even if one fails
      }
    }
  }

  /**
   * Check if a step needs a specific compensation
   */
  private stepNeedsCompensation(stepName: CheckoutStepName, compensationName: string): boolean {
    const compensationMap: Record<CheckoutStepName, string[]> = {
      [CheckoutStepName.VALIDATE_CART]: [],
      [CheckoutStepName.RESERVE_CREDIT]: ['releaseCredit'],
      [CheckoutStepName.RESERVE_STOCK]: ['releaseStock'],
      [CheckoutStepName.CREATE_ORDER]: ['cancelOrder'],
      [CheckoutStepName.CAPTURE_PAYMENT]: ['reversePayment'],
      [CheckoutStepName.FINALIZE]: [],
    };

    return compensationMap[stepName]?.includes(compensationName) ?? false;
  }

  /**
   * Validate cart step
   */
  private async validateCart(cartId: string, customerId: string): Promise<{
    success: boolean;
    data?: { valid: boolean; cartTotal: number };
    error?: string;
  }> {
    // TODO: Implement actual cart validation
    // For now, assume cart is valid
    return {
      success: true,
      data: { valid: true, cartTotal: 0 },
    };
  }

  /**
   * Reserve credit step
   */
  private async reserveCreditStep(
    cartId: string,
    customerId: string
  ): Promise<{ success: boolean; data?: { reservationId: string; orderId: string }; error?: string }> {
    // Get cart to calculate amount
    const cart = await this.financialTransactionService
      .getDataSource()
      .getRepository(CartEntity)
      .findOne({ where: { id: cartId } });

    if (!cart) {
      return { success: false, error: `Cart not found: ${cartId}` };
    }

    const orderId = uuidv4();

    const result = await this.financialTransactionService.reserveCredit({
      customerId,
      orderId,
      amount: cart.total,
    });

    if (result.success && result.data?.reservationId) {
      return {
        success: true,
        data: {
          reservationId: result.data.reservationId,
          orderId,
        },
      };
    }

    return {
      success: false,
      error: result.error?.message || 'Failed to reserve credit',
    };
  }

  /**
   * Reserve stock step
   */
  private async reserveStockStep(
    cartId: string,
    customerId: string
  ): Promise<{ success: boolean; data?: { stockReservationId: string }; error?: string }> {
    // TODO: Implement actual stock reservation
    return {
      success: true,
      data: { stockReservationId: uuidv4() },
    };
  }

  /**
   * Create order step
   */
  private async createOrderStep(
    cartId: string,
    customerId: string
  ): Promise<{ success: boolean; data?: { orderId: string; orderNumber: string }; error?: string }> {
    const result = await this.financialTransactionService.createOrder({
      cartId,
      customerId,
    });

    if (result.success && result.data) {
      return {
        success: true,
        data: {
          orderId: result.data.orderId!,
          orderNumber: result.data.orderNumber!,
        },
      };
    }

    return {
      success: false,
      error: result.error?.message || 'Failed to create order',
    };
  }

  /**
   * Capture credit step
   */
  private async captureCreditStep(
    orderId: string
  ): Promise<{ success: boolean; data?: { transactionId: string }; error?: string }> {
    const result = await this.financialTransactionService.captureCredit({
      orderId,
    });

    if (result.success && result.data) {
      return {
        success: true,
        data: {
          transactionId: result.data.transactionId!,
        },
      };
    }

    return {
      success: false,
      error: result.error?.message || 'Failed to capture credit',
    };
  }

  /**
   * Finalize step
   */
  private async finalizeStep(orderId: string): Promise<{
    success: boolean;
    data?: { finalizedAt: Date };
    error?: string;
  }> {
    // TODO: Implement finalization logic (notifications, etc.)
    return {
      success: true,
      data: { finalizedAt: new Date() },
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase();
    const errorCode = error?.code;

    // PostgreSQL deadlock error
    if (errorCode === '40P01') return true;

    // Network errors
    if (errorMessage?.includes('econnrefused')) return true;
    if (errorMessage?.includes('timeout')) return true;
    if (errorMessage?.includes('network')) return true;

    return false;
  }

  /**
   * Calculate exponential backoff
   */
  private calculateBackoff(attempt: number): number {
    return Math.min(100 * Math.pow(2, attempt), 5000);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default TransactionOrchestrator;
