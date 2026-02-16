/**
 * WhatsApp Template Domain Entity
 *
 * Represents a WhatsApp message template approved by Meta.
 * Handles template lifecycle: creation, validation, and approval tracking.
 *
 * @module whatsapp/domain/entities
 */

/**
 * Language code for templates.
 */
export type TemplateLanguage = 'ro' | 'en';

/**
 * Template category as defined by Meta.
 */
export type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';

/**
 * Status of template in approval workflow.
 */
export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Type of header in template.
 */
export type HeaderType = 'NONE' | 'TEXT' | 'IMAGE' | 'DOCUMENT';

/**
 * Button types for interactive templates.
 */
export type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE';

/**
 * Button definition in template.
 */
export interface TemplateButton {
  type: ButtonType;
  text: string;
  url?: string;
  phoneNumber?: string;
}

/**
 * WhatsApp Template entity.
 *
 * Core domain entity representing a WhatsApp message template.
 * Templates are pre-approved by Meta and used for bulk messaging.
 *
 * @class WhatsAppTemplate
 */
export class WhatsAppTemplate {
  /**
   * Create a new WhatsApp template.
   *
   * @param id - Unique template ID in ERP system
   * @param name - Template name (used as reference)
   * @param language - Language code (ro, en)
   * @param category - Template category (UTILITY, MARKETING, AUTHENTICATION)
   * @param status - Approval status
   * @param headerType - Type of header
   * @param bodyText - Template body with {{1}}, {{2}} placeholders
   * @param createdAt - Template creation timestamp
   * @param updatedAt - Last update timestamp
   * @param headerContent - Content of header (optional)
   * @param footerText - Footer text (optional)
   * @param buttons - List of buttons (optional)
   * @param whatsappTemplateId - ID from Meta API (optional)
   * @param submittedAt - When template was submitted to Meta (optional)
   * @param approvedAt - When template was approved (optional)
   * @param rejectedReason - Reason for rejection if rejected (optional)
   */
  constructor(
    readonly id: string,
    readonly name: string,
    readonly language: TemplateLanguage,
    readonly category: TemplateCategory,
    private status: TemplateStatus,
    readonly headerType: HeaderType,
    readonly bodyText: string,
    readonly createdAt: Date,
    private updatedAt: Date,
    readonly headerContent?: string,
    readonly footerText?: string,
    readonly buttons: TemplateButton[] = [],
    private whatsappTemplateId?: string,
    private submittedAt?: Date,
    private approvedAt?: Date,
    private rejectedReason?: string,
    readonly parameters: string[] = [],
    readonly isActive: boolean = true,
    private usageCount: number = 0,
  ) { }

  /**
   * Render template with parameters.
   * Replaces {{1}}, {{2}}, etc. placeholders with values.
   *
   * @param params - Array of parameters to fill placeholders
   * @returns Rendered message text
   * @throws {Error} If parameter count doesn't match placeholder count
   */
  render(params: string[]): string {
    let rendered = this.bodyText;
    const placeholders = this.bodyText.match(/\{\{\d+\}\}/g) || [];
    const uniquePlaceholders = [...new Set(placeholders)];

    if (params.length < uniquePlaceholders.length) {
      throw new Error(
        `Not enough parameters. Expected ${uniquePlaceholders.length}, got ${params.length}`
      );
    }

    for (let i = 0; i < uniquePlaceholders.length; i++) {
      rendered = rendered.replace(
        new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'),
        params[i]
      );
    }

    return rendered;
  }

  /**
   * Validate template structure.
   * Checks for required fields and format compliance.
   *
   * @throws {Error} If template is invalid
   */
  validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Template name is required');
    }

    if (!this.bodyText || this.bodyText.trim().length === 0) {
      throw new Error('Template body is required');
    }

    if (this.bodyText.length > 4096) {
      throw new Error('Template body exceeds maximum length (4096 chars)');
    }

    if (this.headerType !== 'NONE' && !this.headerContent) {
      throw new Error(
        `Header type ${this.headerType} requires header content`
      );
    }

    if (this.footerText && this.footerText.length > 60) {
      throw new Error('Footer text exceeds maximum length (60 chars)');
    }

    for (const button of this.buttons) {
      if (!button.text || button.text.trim().length === 0) {
        throw new Error('Button text is required');
      }
      if (button.type === 'URL' && !button.url) {
        throw new Error('URL button requires url property');
      }
      if (button.type === 'PHONE' && !button.phoneNumber) {
        throw new Error('PHONE button requires phoneNumber property');
      }
    }
  }

  /**
   * Check if template is approved.
   * Only approved templates can be used for sending.
   *
   * @returns True if template is approved
   */
  isApproved(): boolean {
    return this.status === 'APPROVED';
  }

  /**
   * Mark template as submitted to Meta.
   *
   * @param whatsappId - ID assigned by Meta API
   */
  markSubmitted(whatsappId?: string): void {
    if (this.status !== 'PENDING') {
      return; // Idempotent
    }
    this.submittedAt = new Date();
    if (whatsappId) {
      this.whatsappTemplateId = whatsappId;
    }
    this.updatedAt = new Date();
  }

  /**
   * Mark template as approved by Meta.
   */
  markApproved(): void {
    if (this.status === 'APPROVED') {
      return; // Idempotent
    }
    this.status = 'APPROVED';
    this.approvedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark template as rejected by Meta.
   *
   * @param reason - Reason for rejection
   */
  markRejected(reason: string): void {
    if (this.status === 'REJECTED') {
      return; // Idempotent
    }
    this.status = 'REJECTED';
    this.rejectedReason = reason;
    this.updatedAt = new Date();
  }

  /**
   * Get required parameters from template body.
   * Returns the placeholder indices found in the body.
   *
   * @returns Array of required parameter names (e.g., ['1', '2', '3'])
   */
  getRequiredParams(): string[] {
    const placeholders = this.bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const uniqueIndices = [...new Set(placeholders.map(p => p.slice(2, -2)))];
    return uniqueIndices.sort((a, b) => parseInt(a) - parseInt(b));
  }

  /**
   * Get current status.
   * @internal
   */
  getStatus(): TemplateStatus {
    return this.status;
  }

  /**
   * Get WhatsApp template ID.
   * @internal
   */
  getWhatsAppTemplateId(): string | undefined {
    return this.whatsappTemplateId;
  }

  /**
   * Get submitted timestamp.
   * @internal
   */
  getSubmittedAt(): Date | undefined {
    return this.submittedAt;
  }

  /**
   * Get approved timestamp.
   * @internal
   */
  getApprovedAt(): Date | undefined {
    return this.approvedAt;
  }

  /**
   * Get rejection reason.
   * @internal
   */
  getRejectedReason(): string | undefined {
    return this.rejectedReason;
  }

  /**
   * Get last update timestamp.
   * @internal
   */
  getUpdatedAt(): Date {
    return this.updatedAt;
  }
  /**
   * Get usage count.
   * @internal
   */
  getUsageCount(): number {
    return this.usageCount;
  }

  /**
   * Increment usage count.
   */
  incrementUsage(): void {
    this.usageCount++;
    this.updatedAt = new Date();
  }
}
