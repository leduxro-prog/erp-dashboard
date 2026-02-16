/**
 * RegisterB2B Use Case
 * Handles B2B company registration submission and validation.
 *
 * @module B2B Portal - Application
 */

import { B2BRegistration } from '../../domain/entities/B2BRegistration';
import { IRegistrationRepository } from '../../domain/repositories/IRegistrationRepository';
import { CuiValidationService } from '../../domain/services/CuiValidationService';
import { AnafValidationService } from '../../infrastructure/services/AnafValidationService';
import {
  RegistrationExistsError,
  InvalidCuiError,
  InvalidIbanError,
} from '../../domain/errors/b2b.errors';
import { createModuleLogger } from '@shared/utils/logger';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const logger = createModuleLogger('RegisterB2B');

/**
 * Input DTO for registration
 */
export interface RegisterB2BInput {
  companyName: string;
  cui: string;
  regCom: string;
  legalAddress: string;
  deliveryAddress: string;
  contactPerson: string;
  email: string;
  phone: string;
  bankName: string;
  iban: string;
  requestedTier: string;
  paymentTermsDays?: number;
  notes?: string;
}

/**
 * Output DTO for registration
 */
export interface RegisterB2BOutput {
  id: string;
  status: string;
  companyName: string;
  email: string;
  cui: string;
  createdAt: Date;
}

export class RegisterB2B {
  private readonly anafValidationService: AnafValidationService;

  /**
   * Create a new RegisterB2B use case.
   *
   * @param registrationRepository - Registration repository
   * @param cuiValidationService - CUI validation service
   * @param eventPublisher - Event publisher callback
   * @param notificationService - Notification service callback
   * @param dataSource - TypeORM DataSource for settings access
   */
  constructor(
    private readonly registrationRepository: IRegistrationRepository,
    private readonly cuiValidationService: CuiValidationService,
    private readonly eventPublisher: (event: string, data: unknown) => Promise<void>,
    private readonly notificationService: (data: unknown) => Promise<void>,
    private readonly dataSource?: DataSource,
  ) {
    this.anafValidationService = new AnafValidationService();
  }

  /**
   * Read B2B settings from file
   */
  private async getB2BSettings(): Promise<{
    approvalMode: 'manual' | 'auto';
    defaultCreditLimit: number;
  }> {
    try {
      const settingsPath = path.join(process.cwd(), 'config', 'settings.json');
      const settingsData = await fs.promises.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsData);
      return {
        approvalMode: settings.b2b?.approvalMode || (settings.b2b?.autoApprove ? 'auto' : 'manual'),
        defaultCreditLimit: parseFloat(settings.b2b?.defaultCreditLimit || '0'),
      };
    } catch (error) {
      logger.warn('Could not read settings, using defaults', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { approvalMode: 'manual', defaultCreditLimit: 0 };
    }
  }

  /**
   * Execute the use case.
   *
   * @param input - Registration input data
   * @returns Registration output
   */
  async execute(input: RegisterB2BInput): Promise<RegisterB2BOutput> {
    if (!this.cuiValidationService.validateFormat(input.cui)) {
      throw new InvalidCuiError(input.cui);
    }

    const anafResult = await this.anafValidationService.validateCui(input.cui);
    if (!anafResult.valid) {
      if (anafResult.code === 'NOT_FOUND') {
        throw new InvalidCuiError(
          input.cui,
          'CUI not found in ANAF database. Please verify the company registration number.',
        );
      }
      if (anafResult.code === 'INVALID_FORMAT') {
        throw new InvalidCuiError(input.cui, anafResult.error);
      }
    }

    const anafCompanyData = anafResult.valid ? anafResult.company : null;

    const existingRegistration = await this.registrationRepository.findByCui(input.cui);
    if (existingRegistration) {
      throw new RegistrationExistsError(input.cui);
    }

    const existingEmail = await this.registrationRepository.findByEmail(input.email);
    if (existingEmail) {
      throw new RegistrationExistsError(input.email);
    }

    if (!B2BRegistration.isValidIban(input.iban)) {
      throw new InvalidIbanError(input.iban);
    }

    const companyName = anafCompanyData?.denumire || input.companyName;
    const legalAddress = anafCompanyData?.adresa || input.legalAddress;
    const regCom = anafCompanyData?.nrRegCom || input.regCom;

    const registration = new B2BRegistration(
      undefined,
      companyName,
      input.cui,
      regCom,
      legalAddress,
      input.deliveryAddress,
      input.contactPerson,
      input.email,
      input.phone,
      input.bankName,
      input.iban,
      input.requestedTier,
      input.paymentTermsDays || 0,
      input.notes || '',
    );

    // Save registration
    const savedRegistration = await this.registrationRepository.save(registration);

    // Check if auto-approve is enabled
    const settings = await this.getB2BSettings();

    let responseStatus: string = savedRegistration.status;

    if (settings.approvalMode === 'auto' && this.dataSource) {
      const creditLimit = settings.defaultCreditLimit || 5000;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
      const randomBytes = crypto.randomBytes(12);
      let tempPassword = '';
      for (let i = 0; i < 12; i++) {
        tempPassword += chars[randomBytes[i] % chars.length];
      }
      tempPassword = tempPassword.slice(0, 8) + 'A' + 'a' + '1' + '!';

      try {
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const customerId = await this.dataSource.transaction(async (manager) => {
          const customerResult = await manager.query(
            `INSERT INTO b2b_customers (
              company_name, cui, email, contact_person, phone, tier, credit_limit,
              credit_used, payment_terms_days, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, 'ACTIVE', NOW(), NOW())
            RETURNING id`,
            [
              savedRegistration.companyName,
              savedRegistration.cui,
              savedRegistration.email,
              savedRegistration.contactPerson,
              savedRegistration.phone,
              savedRegistration.requestedTier,
              creditLimit,
              savedRegistration.paymentTermsDays,
            ],
          );

          const createdCustomerId = customerResult[0].id;

          await manager.query(
            `INSERT INTO b2b_auth_credentials
             (customer_id, email, password_hash, must_change_password, created_at, updated_at)
             VALUES ($1, $2, $3, true, NOW(), NOW())
             ON CONFLICT (email) DO NOTHING`,
            [createdCustomerId, savedRegistration.email, passwordHash],
          );

          await manager.query(
            `UPDATE b2b_registrations
             SET status = $1, reviewed_at = NOW(), updated_at = NOW()
             WHERE id = $2`,
            ['APPROVED', savedRegistration.id],
          );

          await manager.query(
            `INSERT INTO audit_logs (action, entity_type, entity_id, new_values, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [
              'B2B_REGISTRATION_AUTO_APPROVE',
              'B2B_REGISTRATION',
              savedRegistration.id,
              JSON.stringify({
                customer_id: createdCustomerId,
                company: savedRegistration.companyName,
              }),
              JSON.stringify({ system: 'auto-approval-engine' }),
            ],
          );

          return createdCustomerId;
        });

        responseStatus = 'approved';

        try {
          await this.eventPublisher('b2b.registration_auto_approved', {
            registrationId: savedRegistration.id!,
            customerId,
            companyName: savedRegistration.companyName,
            cui: savedRegistration.cui,
            email: savedRegistration.email,
            creditLimit,
            tempPassword,
          });
        } catch (error) {
          logger.error('Failed to publish auto-approval event', {
            error: error instanceof Error ? error.message : String(error),
            registrationId: savedRegistration.id,
          });
        }

        try {
          await this.notificationService({
            type: 'B2B_AUTO_APPROVED',
            recipientId: String(customerId),
            customerId,
            registrationId: savedRegistration.id!,
            companyName: savedRegistration.companyName,
            email: savedRegistration.email,
            creditLimit,
            tempPassword,
          });
        } catch (error) {
          logger.error('Failed to send auto-approval notification', {
            error: error instanceof Error ? error.message : String(error),
            registrationId: savedRegistration.id,
          });
        }
      } catch (error) {
        logger.error('Auto-approval failed', {
          error: error instanceof Error ? error.message : String(error),
          registrationId: savedRegistration.id,
          companyName: savedRegistration.companyName,
        });
      }
    } else {
      // Manual approval: Publish event and notify admin
      await this.eventPublisher('b2b.registration_submitted', {
        registrationId: savedRegistration.id!,
        companyName: savedRegistration.companyName,
        cui: savedRegistration.cui,
        email: savedRegistration.email,
        requestedTier: savedRegistration.requestedTier,
        createdAt: savedRegistration.createdAt,
      });

      // Audit Logging for submission
      if (this.dataSource) {
        await this.dataSource.query(
          `INSERT INTO audit_logs (action, entity_type, entity_id, new_values, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [
            'B2B_REGISTRATION_SUBMIT',
            'B2B_REGISTRATION',
            savedRegistration.id,
            JSON.stringify({
              company: savedRegistration.companyName,
              email: savedRegistration.email,
            }),
          ],
        );
      }

      // Notify admin
      try {
        const adminEmail = process.env['B2B_ADMIN_EMAIL'] || 'b2b-admin@localhost';
        await this.notificationService({
          type: 'B2B_REGISTRATION_SUBMITTED',
          recipientId: 'b2b-admin',
          registrationId: savedRegistration.id!,
          companyName: savedRegistration.companyName,
          email: adminEmail,
          subject: `B2B registration: ${savedRegistration.companyName}`,
          message: `A new B2B registration was submitted by ${savedRegistration.companyName} (${savedRegistration.email}).`,
        });
      } catch (e) {
        logger.error('Admin notification failed', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      id: savedRegistration.id!,
      status: responseStatus,
      companyName: savedRegistration.companyName,
      email: savedRegistration.email,
      cui: savedRegistration.cui,
      createdAt: savedRegistration.createdAt,
    };
  }
}
