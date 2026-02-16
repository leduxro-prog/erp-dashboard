/**
 * B2B Registration Domain Entity
 * Represents a company's request to register as a B2B customer.
 *
 * @module B2B Portal - Domain
 */

import {
  RegistrationExistsError,
  InvalidCuiError,
  InvalidIbanError,
  InvalidRegistrationStateError,
} from '../errors/b2b.errors';

/**
 * B2B Registration Status enumeration
 */
export enum B2BRegistrationStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

/**
 * Represents an uploaded document for B2B registration.
 */
export interface RegistrationDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

/**
 * B2B Registration Domain Entity
 *
 * Encapsulates the business logic for B2B customer registration including:
 * - CUI (Romanian fiscal code) validation
 * - IBAN validation
 * - Status transitions and approval workflow
 * - Document management
 *
 * @class B2BRegistration
 */
export class B2BRegistration {
  /**
   * Unique registration identifier
   */
  readonly id?: string;

  /**
   * Company name
   */
  readonly companyName: string;

  /**
   * Romanian CUI (Cod Unic de Înregistrare) - 2 to 10 digits
   */
  readonly cui: string;

  /**
   * Romanian Trade Registry Number (Registrul Comerţului)
   */
  readonly regCom: string;

  /**
   * Company legal address
   */
  readonly legalAddress: string;

  /**
   * Company delivery address (may differ from legal)
   */
  readonly deliveryAddress: string;

  /**
   * Primary contact person name
   */
  readonly contactPerson: string;

  /**
   * Contact email address
   */
  readonly email: string;

  /**
   * Contact phone number
   */
  readonly phone: string;

  /**
   * Bank name where company holds account
   */
  readonly bankName: string;

  /**
   * Bank account IBAN
   */
  readonly iban: string;

  /**
   * Requested pricing tier
   */
  readonly requestedTier: string;

  /**
   * Current registration status
   */
  private _status: B2BRegistrationStatus;

  /**
   * User ID of reviewer/approver
   */
  private _reviewedBy?: string;

  /**
   * Timestamp of last review action
   */
  private _reviewedAt?: Date;

  /**
   * Reason for rejection (if status is REJECTED)
   */
  private _rejectionReason?: string;

  /**
   * Uploaded documents
   */
  private _documents: RegistrationDocument[];

  /**
   * Credit limit assigned at approval
   */
  private _creditLimit?: number;

  /**
   * Payment terms in days (0, 15, 30, 45, 60)
   */
  private _paymentTermsDays: number;

  /**
   * Internal notes about the registration
   */
  private _notes: string;

  /**
   * Creation timestamp
   */
  readonly createdAt: Date;

  /**
   * Last update timestamp
   */
  private _updatedAt: Date;

  /**
   * Create a new B2B Registration entity.
   * Validates CUI and IBAN formats on construction.
   *
   * @param id - Unique registration ID
   * @param companyName - Name of the company
   * @param cui - Romanian CUI (must be valid)
   * @param regCom - Trade registry number
   * @param legalAddress - Company legal address
   * @param deliveryAddress - Delivery address
   * @param contactPerson - Contact person name
   * @param email - Contact email
   * @param phone - Contact phone
   * @param bankName - Bank name
   * @param iban - Bank account IBAN (must be valid)
   * @param requestedTier - Requested pricing tier
   * @param paymentTermsDays - Requested payment terms (default: 0)
   * @param notes - Internal notes
   * @throws {InvalidCuiError} If CUI format is invalid
   * @throws {InvalidIbanError} If IBAN format is invalid
   */
  constructor(
    id: string | undefined,
    companyName: string,
    cui: string,
    regCom: string,
    legalAddress: string,
    deliveryAddress: string,
    contactPerson: string,
    email: string,
    phone: string,
    bankName: string,
    iban: string,
    requestedTier: string,
    paymentTermsDays: number = 0,
    notes: string = ''
  ) {
    // Validate CUI format
    if (!B2BRegistration.isValidCui(cui)) {
      throw new InvalidCuiError(cui);
    }

    // Validate IBAN format
    if (!B2BRegistration.isValidIban(iban)) {
      throw new InvalidIbanError(iban);
    }

    this.id = id;
    this.companyName = companyName;
    this.cui = cui;
    this.regCom = regCom;
    this.legalAddress = legalAddress;
    this.deliveryAddress = deliveryAddress;
    this.contactPerson = contactPerson;
    this.email = email;
    this.phone = phone;
    this.bankName = bankName;
    this.iban = iban;
    this.requestedTier = requestedTier;
    this._paymentTermsDays = paymentTermsDays;
    this._notes = notes;
    this._status = B2BRegistrationStatus.PENDING;
    this._documents = [];
    this.createdAt = new Date();
    this._updatedAt = new Date();
  }

  // ============================================
  // Getters
  // ============================================

  /**
   * Get current registration status
   */
  get status(): B2BRegistrationStatus {
    return this._status;
  }

  /**
   * Get reviewer user ID
   */
  get reviewedBy(): string | undefined {
    return this._reviewedBy;
  }

  /**
   * Get review timestamp
   */
  get reviewedAt(): Date | undefined {
    return this._reviewedAt;
  }

  /**
   * Get rejection reason
   */
  get rejectionReason(): string | undefined {
    return this._rejectionReason;
  }

  /**
   * Get documents
   */
  get documents(): RegistrationDocument[] {
    return [...this._documents];
  }

  /**
   * Get assigned credit limit
   */
  get creditLimit(): number | undefined {
    return this._creditLimit;
  }

  /**
   * Get payment terms in days
   */
  get paymentTermsDays(): number {
    return this._paymentTermsDays;
  }

  /**
   * Get internal notes
   */
  get notes(): string {
    return this._notes;
  }

  /**
   * Get last update timestamp
   */
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ============================================
  // Business Logic Methods
  // ============================================

  /**
   * Approve the registration and create B2B customer.
   * Transitions from PENDING or UNDER_REVIEW to APPROVED.
   *
   * @param reviewerId - User ID of the approver
   * @param tier - Approved pricing tier
   * @param creditLimit - Approved credit limit
   * @param paymentTermsDays - Approved payment terms
   * @throws {InvalidRegistrationStateError} If status doesn't allow approval
   */
  approve(
    reviewerId: string,
    tier: string,
    creditLimit: number,
    paymentTermsDays: number
  ): void {
    if (
      this._status !== B2BRegistrationStatus.PENDING &&
      this._status !== B2BRegistrationStatus.UNDER_REVIEW
    ) {
      throw new InvalidRegistrationStateError(this._status, 'approve');
    }

    this._status = B2BRegistrationStatus.APPROVED;
    this._reviewedBy = reviewerId;
    this._reviewedAt = new Date();
    this._creditLimit = creditLimit;
    this._paymentTermsDays = paymentTermsDays;
    this._updatedAt = new Date();
  }

  /**
   * Reject the registration.
   * Transitions from PENDING or UNDER_REVIEW to REJECTED.
   *
   * @param reviewerId - User ID of the reviewer
   * @param reason - Reason for rejection
   * @throws {InvalidRegistrationStateError} If status doesn't allow rejection
   */
  reject(reviewerId: string, reason: string): void {
    if (
      this._status !== B2BRegistrationStatus.PENDING &&
      this._status !== B2BRegistrationStatus.UNDER_REVIEW
    ) {
      throw new InvalidRegistrationStateError(this._status, 'reject');
    }

    this._status = B2BRegistrationStatus.REJECTED;
    this._reviewedBy = reviewerId;
    this._reviewedAt = new Date();
    this._rejectionReason = reason;
    this._updatedAt = new Date();
  }

  /**
   * Mark registration as under review.
   * Transitions from PENDING to UNDER_REVIEW.
   *
   * @throws {InvalidRegistrationStateError} If not in PENDING status
   */
  markAsUnderReview(): void {
    if (this._status !== B2BRegistrationStatus.PENDING) {
      throw new InvalidRegistrationStateError(
        this._status,
        'mark as under review'
      );
    }

    this._status = B2BRegistrationStatus.UNDER_REVIEW;
    this._updatedAt = new Date();
  }

  /**
   * Suspend the registration (e.g., due to fraud or compliance issues).
   * Can be called from APPROVED status only.
   *
   * @param reason - Reason for suspension
   * @throws {InvalidRegistrationStateError} If not in APPROVED status
   */
  suspend(reason: string): void {
    if (this._status !== B2BRegistrationStatus.APPROVED) {
      throw new InvalidRegistrationStateError(this._status, 'suspend');
    }

    this._status = B2BRegistrationStatus.SUSPENDED;
    this._rejectionReason = reason;
    this._updatedAt = new Date();
  }

  /**
   * Reactivate a suspended registration.
   *
   * @throws {InvalidRegistrationStateError} If not in SUSPENDED status
   */
  reactivate(): void {
    if (this._status !== B2BRegistrationStatus.SUSPENDED) {
      throw new InvalidRegistrationStateError(this._status, 'reactivate');
    }

    this._status = B2BRegistrationStatus.APPROVED;
    this._rejectionReason = undefined;
    this._updatedAt = new Date();
  }

  /**
   * Check if registration is active (approved and not suspended).
   *
   * @returns true if status is APPROVED
   */
  isActive(): boolean {
    return this._status === B2BRegistrationStatus.APPROVED;
  }

  /**
   * Add a document to the registration.
   *
   * @param document - Document to add
   */
  addDocument(document: RegistrationDocument): void {
    this._documents.push(document);
    this._updatedAt = new Date();
  }

  /**
   * Remove a document from the registration.
   *
   * @param documentId - ID of document to remove
   */
  removeDocument(documentId: string): void {
    const index = this._documents.findIndex((d) => d.id === documentId);
    if (index >= 0) {
      this._documents.splice(index, 1);
      this._updatedAt = new Date();
    }
  }

  /**
   * Update internal notes.
   *
   * @param notes - New notes
   */
  updateNotes(notes: string): void {
    this._notes = notes;
    this._updatedAt = new Date();
  }

  // ============================================
  // Static Validation Methods
  // ============================================

  /**
   * Validate Romanian CUI (Cod Unic de Înregistrare).
   * Must be 2-10 digits with a valid Luhn check digit.
   *
   * @param cui - CUI to validate
   * @returns true if valid
   */
  static isValidCui(cui: string): boolean {
    // Remove whitespace and RO prefix
    let cleaned = cui.trim().replace(/^RO/i, '');

    // Must be 2-10 digits
    if (!/^\d{2,10}$/.test(cleaned)) {
      return false;
    }

    // Legacy short CUIs (2-3 digits) are accepted without checksum
    if (cleaned.length <= 3) {
      return true;
    }

    // Romanian CUI check digit algorithm
    // Test key: 753217532
    const testKey = [7, 5, 3, 2, 1, 7, 5, 3, 2];
    const digits = cleaned.split('').map(Number);
    const checkDigit = digits[digits.length - 1];

    // Pad the CUI (without check digit) with leading zeros to 9 digits
    const cuiWithoutCheck = cleaned.slice(0, -1).padStart(9, '0').split('').map(Number);

    // Multiply each digit by corresponding key digit and sum
    const sum = cuiWithoutCheck.reduce((acc, digit, index) => {
      return acc + digit * testKey[index];
    }, 0);

    // Check digit = (sum * 10) % 11; if result is 10, check digit is 0
    let calculatedCheckDigit = (sum * 10) % 11;
    if (calculatedCheckDigit === 10) {
      calculatedCheckDigit = 0;
    }

    return checkDigit === calculatedCheckDigit;
  }

  /**
   * Validate IBAN format (basic ISO 13616 validation).
   * Performs length and format checks but not full IBAN validity.
   *
   * @param iban - IBAN to validate
   * @returns true if valid format
   */
  static isValidIban(iban: string): boolean {
    // IBAN is optional - allow empty values
    const cleaned = iban.replace(/\s/g, '').toUpperCase();
    if (cleaned.length === 0) {
      return true;
    }

    // IBAN length 15-34 characters
    if (cleaned.length < 15 || cleaned.length > 34) {
      return false;
    }

    // First 2 chars are letters, next 2 are digits
    if (!/^[A-Z]{2}\d{2}/.test(cleaned)) {
      return false;
    }

    // Rest must be alphanumeric
    if (!/^[A-Z0-9]+$/.test(cleaned)) {
      return false;
    }

    // Validate known country lengths for stricter enterprise validation
    const countryCode = cleaned.slice(0, 2);
    const countryIbanLengths: Record<string, number> = {
      RO: 24,
      DE: 22,
      FR: 27,
      IT: 27,
      ES: 24,
      GB: 22,
      NL: 18,
      BE: 16,
      AT: 20,
      CH: 21,
    };

    const expectedLength = countryIbanLengths[countryCode];
    if (!expectedLength) {
      return false;
    }

    return cleaned.length === expectedLength;
  }
}
