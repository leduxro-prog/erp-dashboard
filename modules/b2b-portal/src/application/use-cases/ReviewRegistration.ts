/**
 * ReviewRegistration Use Case
 * Handles approval/rejection of B2B registration requests by admin.
 *
 * @module B2B Portal - Application
 */

import { B2BRegistration, B2BRegistrationStatus } from '../../domain/entities/B2BRegistration';
import { B2BCustomer, B2BCustomerTier } from '../../domain/entities/B2BCustomer';
import { IRegistrationRepository } from '../../domain/repositories/IRegistrationRepository';
import { IB2BCustomerRepository } from '../../domain/repositories/IB2BCustomerRepository';
import { NotFoundError } from '@shared/errors/BaseError';
import { createModuleLogger } from '@shared/utils/logger';
import { InvalidRegistrationStateError } from '../../domain/errors/b2b.errors';
import { TierCalculationService } from '../../domain/services/TierCalculationService';
import { randomUUID, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

const logger = createModuleLogger('ReviewRegistration');

/**
 * Input DTO for review action
 */
export interface ReviewRegistrationInput {
  registrationId: string;
  action: 'APPROVE' | 'REJECT';
  tier?: string;
  creditLimit?: number;
  paymentTermsDays?: number;
  reason?: string;
  reviewerId: string;
}

/**
 * Output DTO
 */
export interface ReviewRegistrationOutput {
  registrationId: string;
  status: string;
  customerId?: string;
  message: string;
}

/**
 * ReviewRegistration Use Case
 *
 * Implements the business logic for registration review:
 * - APPROVE: Creates B2BCustomer, assigns tier/credit, publishes APPROVED event
 * - REJECT: Updates status, publishes REJECTED event
 * - Validates state transitions
 * - Notifies customer of decision
 *
 * @class ReviewRegistration
 */
export class ReviewRegistration {
  /**
   * Create a new ReviewRegistration use case.
   *
   * @param registrationRepository - Registration repository
   * @param customerRepository - Customer repository
   * @param tierService - Tier calculation service
   * @param eventPublisher - Event publisher callback
   * @param notificationService - Notification service callback
   */
  constructor(
    private readonly registrationRepository: IRegistrationRepository,
    private readonly customerRepository: IB2BCustomerRepository,
    private readonly tierService: TierCalculationService,
    private readonly eventPublisher: (event: string, data: unknown) => Promise<void>,
    private readonly notificationService: (data: unknown) => Promise<void>,
    private readonly dataSource?: DataSource,
  ) {}

  /**
   * Execute the use case.
   *
   * @param input - Review input
   * @returns Review output
   * @throws {NotFoundError} If registration not found
   * @throws {InvalidRegistrationStateError} If registration state doesn't allow action
   */
  async execute(input: ReviewRegistrationInput): Promise<ReviewRegistrationOutput> {
    // Load registration
    const registration = await this.registrationRepository.findById(input.registrationId);
    if (!registration) {
      throw new NotFoundError('B2B Registration', input.registrationId);
    }

    if (input.action === 'APPROVE') {
      return this.handleApproval(registration, input);
    } else {
      return this.handleRejection(registration, input);
    }
  }

  /**
   * Handle approval action.
   *
   * @param registration - Registration to approve
   * @param input - Review input
   * @returns Review output
   * @private
   */
  private async handleApproval(
    registration: B2BRegistration,
    input: ReviewRegistrationInput,
  ): Promise<ReviewRegistrationOutput> {
    // Validate current state allows approval
    if (
      registration.status !== B2BRegistrationStatus.PENDING &&
      registration.status !== B2BRegistrationStatus.UNDER_REVIEW
    ) {
      throw new InvalidRegistrationStateError(registration.status, 'approve');
    }

    // Use provided tier or default to STANDARD
    const tier = (input.tier as B2BCustomerTier) || B2BCustomerTier.STANDARD;

    // Use provided credit limit or default to 10000
    const creditLimit = input.creditLimit || 10000;

    // Use provided payment terms or calculate from tier
    const paymentTermsDays =
      input.paymentTermsDays !== undefined
        ? input.paymentTermsDays
        : this.tierService.getPaymentTermsForTier(tier);

    // Approve registration
    registration.approve(input.reviewerId, tier, creditLimit, paymentTermsDays);

    // Save updated registration
    await this.registrationRepository.save(registration);

    // Create B2B customer from registration
    const customerId = `cust_${randomUUID()}`;
    const customer = new B2BCustomer(
      customerId,
      registration.id!,
      registration.companyName,
      registration.cui,
      tier,
      creditLimit,
      paymentTermsDays,
    );

    const savedCustomer = await this.customerRepository.save(customer);

    // Create B2B auth credentials so the customer can log in
    let tempPassword: string | undefined;
    if (this.dataSource) {
      try {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
        tempPassword = '';
        const bytes = randomBytes(12);
        for (let i = 0; i < 12; i++) {
          tempPassword += chars[bytes[i] % chars.length];
        }
        tempPassword = tempPassword.slice(0, 8) + 'A' + 'a' + '1' + '!';

        const passwordHash = await bcrypt.hash(tempPassword, 10);

        // Get actual numeric customer ID from DB (savedCustomer.id may be UUID)
        const customerRows = await this.dataSource.query(
          `SELECT id FROM b2b_customers WHERE cui = $1 ORDER BY created_at DESC LIMIT 1`,
          [registration.cui],
        );
        if (customerRows.length === 0) {
          throw new Error('Unable to resolve numeric b2b_customers.id for credential creation');
        }
        const dbCustomerId = customerRows[0].id;

        await this.dataSource.query(
          `INSERT INTO b2b_auth_credentials
           (customer_id, email, password_hash, must_change_password, failed_login_attempts, created_at, updated_at)
           VALUES ($1, $2, $3, true, 0, NOW(), NOW())
           ON CONFLICT (email) DO NOTHING`,
          [dbCustomerId, registration.email, passwordHash],
        );
      } catch (credError) {
        logger.error('Failed to create B2B auth credentials during approval', {
          error: credError instanceof Error ? credError.message : String(credError),
          registrationId: registration.id,
        });
        // Non-fatal: customer is created, credentials can be set up later
      }
    }

    // Publish event
    await this.eventPublisher('b2b.registration_approved', {
      registrationId: registration.id!,
      customerId: savedCustomer.id,
      companyName: registration.companyName,
      email: registration.email,
      tier,
      creditLimit,
      paymentTermsDays,
      tempPassword,
    });

    // Notify customer (best-effort)
    try {
      await this.notificationService({
        type: 'B2B_REGISTRATION_APPROVED',
        recipientId: String(savedCustomer.id),
        customerId: savedCustomer.id,
        email: registration.email,
        companyName: registration.companyName,
        tier,
        creditLimit,
        tempPassword,
      });
    } catch (notificationError) {
      logger.error('Failed to enqueue B2B approval notification', {
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
        registrationId: registration.id,
      });
    }

    return {
      registrationId: registration.id!,
      status: registration.status,
      customerId: savedCustomer.id,
      message: `Registration approved. Customer created with ID ${savedCustomer.id}`,
    };
  }

  /**
   * Handle rejection action.
   *
   * @param registration - Registration to reject
   * @param input - Review input
   * @returns Review output
   * @private
   */
  private async handleRejection(
    registration: B2BRegistration,
    input: ReviewRegistrationInput,
  ): Promise<ReviewRegistrationOutput> {
    // Validate current state allows rejection
    if (
      registration.status !== B2BRegistrationStatus.PENDING &&
      registration.status !== B2BRegistrationStatus.UNDER_REVIEW
    ) {
      throw new InvalidRegistrationStateError(registration.status, 'reject');
    }

    const reason = input.reason || 'No reason provided';

    // Reject registration
    registration.reject(input.reviewerId, reason);

    // Save updated registration
    await this.registrationRepository.save(registration);

    // Publish event
    await this.eventPublisher('b2b.registration_rejected', {
      registrationId: registration.id!,
      companyName: registration.companyName,
      email: registration.email,
      reason,
    });

    // Notify customer (best-effort)
    try {
      await this.notificationService({
        type: 'B2B_REGISTRATION_REJECTED',
        recipientId: String(registration.id || registration.email),
        email: registration.email,
        companyName: registration.companyName,
        reason,
      });
    } catch (notificationError) {
      logger.error('Failed to enqueue B2B rejection notification', {
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
        registrationId: registration.id,
      });
    }

    return {
      registrationId: registration.id!,
      status: registration.status,
      message: `Registration rejected. Reason: ${reason}`,
    };
  }
}
