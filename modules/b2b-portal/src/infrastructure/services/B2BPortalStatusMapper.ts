/**
 * B2B Portal Status Mapper
 * Maps statuses between external B2B Portal and internal ERP system.
 *
 * This service handles bidirectional status mapping:
 * - B2B Portal Order Status -> ERP Order Status
 * - ERP Order Status -> B2B Portal Order Status
 * - B2B Portal Invoice Status -> ERP Invoice Status
 * - ERP Invoice Status -> B2B Portal Invoice Status
 *
 * @module B2B Portal - Infrastructure Services
 */

import { Logger } from 'winston';
import {
  B2BPortalOrderStatus,
  B2BPortalInvoiceStatus,
} from './B2BPortalApiClient';

export { B2BPortalOrderStatus, B2BPortalInvoiceStatus };

/**
 * Internal ERP order statuses
 */
export type ErpOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'REFUNDED'
  | 'ON_HOLD';

/**
 * Internal ERP invoice statuses
 */
export type ErpInvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'SENT'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'VOID';

/**
 * Status mapping result with additional metadata
 */
export interface StatusMappingResult<T> {
  /**
   * Mapped status
   */
  status: T;

  /**
   * Whether the mapping is exact or approximate
   */
  mappingType: 'exact' | 'approximate' | 'fallback';

  /**
   * Original status before mapping
   */
  originalStatus: string;

  /**
   * Optional warning if mapping was not exact
   */
  warning?: string;
}

/**
 * Status mapping configuration
 */
export interface StatusMappingConfig {
  /**
   * Custom order status mappings
   */
  customOrderMappings?: Record<B2BPortalOrderStatus, ErpOrderStatus>;

  /**
   * Custom invoice status mappings
   */
  customInvoiceMappings?: Record<B2BPortalInvoiceStatus, ErpInvoiceStatus>;

  /**
   * Require exact mappings only (fail on unknown statuses)
   */
  strictMode?: boolean;

  /**
   * Default status when mapping fails
   */
  defaultOrderStatus?: ErpOrderStatus;
  defaultInvoiceStatus?: ErpInvoiceStatus;
}

/**
 * Status metadata for transitions
 */
export interface StatusTransitionMetadata {
  /**
   * Whether the status transition requires notification
   */
  requiresNotification: boolean;

  /**
   * Notification template for the transition
   */
  notificationTemplate?: string;

  /**
   * Whether the status transition affects inventory
   */
  affectsInventory: boolean;

  /**
   * Whether the status transition affects payment
   */
  affectsPayment: boolean;

  /**
   * Additional custom metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * B2B Portal Status Mapper
 *
 * Provides bidirectional status mapping between B2B Portal and ERP.
 * Includes support for custom mappings and strict mode validation.
 */
export class B2BPortalStatusMapper {
  private readonly config: Required<
    Omit<StatusMappingConfig, 'customOrderMappings' | 'customInvoiceMappings'>
  > & {
    customOrderMappings?: Partial<Record<B2BPortalOrderStatus, ErpOrderStatus>>;
    customInvoiceMappings?: Partial<Record<B2BPortalInvoiceStatus, ErpInvoiceStatus>>;
  };

  private readonly logger: Logger;

  /**
   * Default B2B Portal to ERP order status mappings
   */
  private readonly defaultOrderMappings: Record<B2BPortalOrderStatus, ErpOrderStatus> = {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    PROCESSING: 'PROCESSING',
    SHIPPED: 'SHIPPED',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
    RETURNED: 'RETURNED',
    REFUNDED: 'REFUNDED',
    ON_HOLD: 'ON_HOLD',
    PAYMENT_FAILED: 'ON_HOLD',
    PAYMENT_PENDING: 'PENDING',
  };

  /**
   * Default ERP to B2B Portal order status mappings
   */
  private readonly reverseOrderMappings: Record<ErpOrderStatus, B2BPortalOrderStatus> = {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    PROCESSING: 'PROCESSING',
    SHIPPED: 'SHIPPED',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
    RETURNED: 'RETURNED',
    REFUNDED: 'REFUNDED',
    ON_HOLD: 'ON_HOLD',
  };

  /**
   * Default B2B Portal to ERP invoice status mappings
   */
  private readonly defaultInvoiceMappings: Record<B2BPortalInvoiceStatus, ErpInvoiceStatus> = {
    DRAFT: 'DRAFT',
    ISSUED: 'ISSUED',
    SENT: 'SENT',
    VIEWED: 'SENT',
    PAID: 'PAID',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    OVERDUE: 'OVERDUE',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
    VOID: 'VOID',
  };

  /**
   * Default ERP to B2B Portal invoice status mappings
   */
  private readonly reverseInvoiceMappings: Record<ErpInvoiceStatus, B2BPortalInvoiceStatus> = {
    DRAFT: 'DRAFT',
    ISSUED: 'ISSUED',
    SENT: 'SENT',
    PAID: 'PAID',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    OVERDUE: 'OVERDUE',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
    VOID: 'VOID',
  };

  /**
   * Status transition metadata for orders
   */
  private readonly orderTransitionMetadata: Record<
    ErpOrderStatus,
    StatusTransitionMetadata
  > = {
    PENDING: {
      requiresNotification: false,
      affectsInventory: false,
      affectsPayment: false,
    },
    CONFIRMED: {
      requiresNotification: true,
      notificationTemplate: 'order_confirmed',
      affectsInventory: false,
      affectsPayment: false,
    },
    PROCESSING: {
      requiresNotification: true,
      notificationTemplate: 'order_processing',
      affectsInventory: true,
      affectsPayment: false,
    },
    SHIPPED: {
      requiresNotification: true,
      notificationTemplate: 'order_shipped',
      affectsInventory: true,
      affectsPayment: false,
    },
    DELIVERED: {
      requiresNotification: true,
      notificationTemplate: 'order_delivered',
      affectsInventory: false,
      affectsPayment: true,
    },
    CANCELLED: {
      requiresNotification: true,
      notificationTemplate: 'order_cancelled',
      affectsInventory: true,
      affectsPayment: false,
    },
    RETURNED: {
      requiresNotification: true,
      notificationTemplate: 'order_returned',
      affectsInventory: true,
      affectsPayment: true,
    },
    REFUNDED: {
      requiresNotification: true,
      notificationTemplate: 'order_refunded',
      affectsInventory: false,
      affectsPayment: true,
    },
    ON_HOLD: {
      requiresNotification: false,
      affectsInventory: false,
      affectsPayment: false,
    },
  };

  /**
   * Status transition metadata for invoices
   */
  private readonly invoiceTransitionMetadata: Record<
    ErpInvoiceStatus,
    StatusTransitionMetadata
  > = {
    DRAFT: {
      requiresNotification: false,
      affectsInventory: false,
      affectsPayment: false,
    },
    ISSUED: {
      requiresNotification: true,
      notificationTemplate: 'invoice_issued',
      affectsInventory: false,
      affectsPayment: false,
    },
    SENT: {
      requiresNotification: true,
      notificationTemplate: 'invoice_sent',
      affectsInventory: false,
      affectsPayment: false,
    },
    PAID: {
      requiresNotification: true,
      notificationTemplate: 'invoice_paid',
      affectsInventory: false,
      affectsPayment: true,
    },
    PARTIALLY_PAID: {
      requiresNotification: true,
      notificationTemplate: 'invoice_partially_paid',
      affectsInventory: false,
      affectsPayment: true,
    },
    OVERDUE: {
      requiresNotification: true,
      notificationTemplate: 'invoice_overdue',
      affectsInventory: false,
      affectsPayment: false,
    },
    CANCELLED: {
      requiresNotification: true,
      notificationTemplate: 'invoice_cancelled',
      affectsInventory: false,
      affectsPayment: false,
    },
    REFUNDED: {
      requiresNotification: true,
      notificationTemplate: 'invoice_refunded',
      affectsInventory: false,
      affectsPayment: true,
    },
    VOID: {
      requiresNotification: true,
      notificationTemplate: 'invoice_void',
      affectsInventory: false,
      affectsPayment: false,
    },
  };

  constructor(config?: StatusMappingConfig, logger?: Logger) {
    this.config = {
      customOrderMappings: config?.customOrderMappings || {},
      customInvoiceMappings: config?.customInvoiceMappings || {},
      strictMode: config?.strictMode ?? false,
      defaultOrderStatus: config?.defaultOrderStatus || 'PENDING',
      defaultInvoiceStatus: config?.defaultInvoiceStatus || 'DRAFT',
    };

    this.logger = logger ?? this.createDefaultLogger();
  }

  /**
   * Map B2B Portal order status to ERP order status
   *
   * @param b2bStatus - B2B Portal order status
   * @returns Mapped ERP order status with metadata
   */
  mapOrderStatusFromB2B(b2bStatus: B2BPortalOrderStatus | string): StatusMappingResult<ErpOrderStatus> {
    // Use custom mapping if available
    if (this.config.customOrderMappings && b2bStatus in this.config.customOrderMappings) {
      const mapped = this.config.customOrderMappings[b2bStatus as B2BPortalOrderStatus]!;
      this.logger.debug('Using custom order status mapping', {
        from: b2bStatus,
        to: mapped,
      });

      return {
        status: mapped,
        mappingType: 'exact',
        originalStatus: b2bStatus,
      };
    }

    // Use default mapping
    const status = b2bStatus.toUpperCase() as B2BPortalOrderStatus;
    if (status in this.defaultOrderMappings) {
      const mapped = this.defaultOrderMappings[status];
      this.logger.debug('Mapped B2B Portal order status to ERP', {
        from: b2bStatus,
        to: mapped,
      });

      return {
        status: mapped,
        mappingType: 'exact',
        originalStatus: b2bStatus,
      };
    }

    // Handle unknown status
    if (this.config.strictMode) {
      this.logger.error('Unknown B2B Portal order status in strict mode', {
        status: b2bStatus,
      });

      throw new Error(`Unknown B2B Portal order status: ${b2bStatus}`);
    }

    this.logger.warn('Unknown B2B Portal order status, using default', {
      status: b2bStatus,
      default: this.config.defaultOrderStatus,
    });

    return {
      status: this.config.defaultOrderStatus,
      mappingType: 'fallback',
      originalStatus: b2bStatus,
      warning: `Unknown B2B Portal status "${b2bStatus}" mapped to default "${this.config.defaultOrderStatus}"`,
    };
  }

  /**
   * Map ERP order status to B2B Portal order status
   *
   * @param erpStatus - ERP order status
   * @returns Mapped B2B Portal order status with metadata
   */
  mapOrderStatusToB2B(erpStatus: ErpOrderStatus | string): StatusMappingResult<B2BPortalOrderStatus> {
    const status = erpStatus.toUpperCase() as ErpOrderStatus;

    if (status in this.reverseOrderMappings) {
      const mapped = this.reverseOrderMappings[status];
      this.logger.debug('Mapped ERP order status to B2B Portal', {
        from: erpStatus,
        to: mapped,
      });

      return {
        status: mapped,
        mappingType: 'exact',
        originalStatus: erpStatus,
      };
    }

    if (this.config.strictMode) {
      this.logger.error('Unknown ERP order status in strict mode', {
        status: erpStatus,
      });

      throw new Error(`Unknown ERP order status: ${erpStatus}`);
    }

    this.logger.warn('Unknown ERP order status, mapping to PENDING', {
      status: erpStatus,
    });

    return {
      status: 'PENDING',
      mappingType: 'fallback',
      originalStatus: erpStatus,
      warning: `Unknown ERP status "${erpStatus}" mapped to PENDING`,
    };
  }

  /**
   * Map B2B Portal invoice status to ERP invoice status
   *
   * @param b2bStatus - B2B Portal invoice status
   * @returns Mapped ERP invoice status with metadata
   */
  mapInvoiceStatusFromB2B(b2bStatus: B2BPortalInvoiceStatus | string): StatusMappingResult<ErpInvoiceStatus> {
    // Use custom mapping if available
    if (this.config.customInvoiceMappings && b2bStatus in this.config.customInvoiceMappings) {
      const mapped = this.config.customInvoiceMappings[b2bStatus as B2BPortalInvoiceStatus]!;
      this.logger.debug('Using custom invoice status mapping', {
        from: b2bStatus,
        to: mapped,
      });

      return {
        status: mapped,
        mappingType: 'exact',
        originalStatus: b2bStatus,
      };
    }

    // Use default mapping
    const status = b2bStatus.toUpperCase() as B2BPortalInvoiceStatus;
    if (status in this.defaultInvoiceMappings) {
      const mapped = this.defaultInvoiceMappings[status];
      this.logger.debug('Mapped B2B Portal invoice status to ERP', {
        from: b2bStatus,
        to: mapped,
      });

      return {
        status: mapped,
        mappingType: 'exact',
        originalStatus: b2bStatus,
      };
    }

    // Handle unknown status
    if (this.config.strictMode) {
      this.logger.error('Unknown B2B Portal invoice status in strict mode', {
        status: b2bStatus,
      });

      throw new Error(`Unknown B2B Portal invoice status: ${b2bStatus}`);
    }

    this.logger.warn('Unknown B2B Portal invoice status, using default', {
      status: b2bStatus,
      default: this.config.defaultInvoiceStatus,
    });

    return {
      status: this.config.defaultInvoiceStatus,
      mappingType: 'fallback',
      originalStatus: b2bStatus,
      warning: `Unknown B2B Portal status "${b2bStatus}" mapped to default "${this.config.defaultInvoiceStatus}"`,
    };
  }

  /**
   * Map ERP invoice status to B2B Portal invoice status
   *
   * @param erpStatus - ERP invoice status
   * @returns Mapped B2B Portal invoice status with metadata
   */
  mapInvoiceStatusToB2B(erpStatus: ErpInvoiceStatus | string): StatusMappingResult<B2BPortalInvoiceStatus> {
    const status = erpStatus.toUpperCase() as ErpInvoiceStatus;

    if (status in this.reverseInvoiceMappings) {
      const mapped = this.reverseInvoiceMappings[status];
      this.logger.debug('Mapped ERP invoice status to B2B Portal', {
        from: erpStatus,
        to: mapped,
      });

      return {
        status: mapped,
        mappingType: 'exact',
        originalStatus: erpStatus,
      };
    }

    if (this.config.strictMode) {
      this.logger.error('Unknown ERP invoice status in strict mode', {
        status: erpStatus,
      });

      throw new Error(`Unknown ERP invoice status: ${erpStatus}`);
    }

    this.logger.warn('Unknown ERP invoice status, mapping to DRAFT', {
      status: erpStatus,
    });

    return {
      status: 'DRAFT',
      mappingType: 'fallback',
      originalStatus: erpStatus,
      warning: `Unknown ERP status "${erpStatus}" mapped to DRAFT`,
    };
  }

  /**
   * Get transition metadata for order status
   *
   * @param status - ERP order status
   * @returns Transition metadata
   */
  getOrderTransitionMetadata(status: ErpOrderStatus): StatusTransitionMetadata {
    return this.orderTransitionMetadata[status] || {
      requiresNotification: false,
      affectsInventory: false,
      affectsPayment: false,
    };
  }

  /**
   * Get transition metadata for invoice status
   *
   * @param status - ERP invoice status
   * @returns Transition metadata
   */
  getInvoiceTransitionMetadata(status: ErpInvoiceStatus): StatusTransitionMetadata {
    return this.invoiceTransitionMetadata[status] || {
      requiresNotification: false,
      affectsInventory: false,
      affectsPayment: false,
    };
  }

  /**
   * Check if status transition is allowed
   *
   * @param fromStatus - Current status
   * @param toStatus - Target status
   * @param type - 'order' or 'invoice'
   * @returns True if transition is allowed
   */
  isTransitionAllowed(
    fromStatus: string,
    toStatus: string,
    type: 'order' | 'invoice',
  ): boolean {
    // Define allowed transitions for orders
    const allowedOrderTransitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED', 'ON_HOLD'],
      CONFIRMED: ['PROCESSING', 'CANCELLED', 'ON_HOLD'],
      PROCESSING: ['SHIPPED', 'CANCELLED', 'ON_HOLD'],
      SHIPPED: ['DELIVERED'],
      DELIVERED: ['RETURNED', 'REFUNDED'],
      CANCELLED: [],
      RETURNED: ['REFUNDED'],
      REFUNDED: [],
      ON_HOLD: ['PENDING', 'CONFIRMED', 'CANCELLED'],
    };

    // Define allowed transitions for invoices
    const allowedInvoiceTransitions: Record<string, string[]> = {
      DRAFT: ['ISSUED', 'CANCELLED', 'VOID'],
      ISSUED: ['SENT', 'CANCELLED'],
      SENT: ['PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED'],
      PAID: ['REFUNDED'],
      PARTIALLY_PAID: ['PAID', 'OVERDUE'],
      OVERDUE: ['PAID', 'CANCELLED'],
      CANCELLED: [],
      REFUNDED: [],
      VOID: [],
    };

    const allowedTransitions =
      type === 'order' ? allowedOrderTransitions : allowedInvoiceTransitions;

    const transitions = allowedTransitions[fromStatus.toUpperCase()] || [];
    return transitions.includes(toStatus.toUpperCase());
  }

  /**
   * Get all valid B2B Portal order statuses
   *
   * @returns Array of B2B Portal order statuses
   */
  getValidB2BOrderStatuses(): B2BPortalOrderStatus[] {
    return Object.keys(this.defaultOrderMappings) as B2BPortalOrderStatus[];
  }

  /**
   * Get all valid B2B Portal invoice statuses
   *
   * @returns Array of B2B Portal invoice statuses
   */
  getValidB2BInvoiceStatuses(): B2BPortalInvoiceStatus[] {
    return Object.keys(this.defaultInvoiceMappings) as B2BPortalInvoiceStatus[];
  }

  /**
   * Get all valid ERP order statuses
   *
   * @returns Array of ERP order statuses
   */
  getValidErpOrderStatuses(): ErpOrderStatus[] {
    return Object.keys(this.orderTransitionMetadata) as ErpOrderStatus[];
  }

  /**
   * Get all valid ERP invoice statuses
   *
   * @returns Array of ERP invoice statuses
   */
  getValidErpInvoiceStatuses(): ErpInvoiceStatus[] {
    return Object.keys(this.invoiceTransitionMetadata) as ErpInvoiceStatus[];
  }

  /**
   * Create default logger
   */
  private createDefaultLogger(): Logger {
    const winston = require('winston');
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });
  }
}
