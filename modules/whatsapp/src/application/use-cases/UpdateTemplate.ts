/**
 * Update Template Use-Case
 *
 * Updates an existing WhatsApp message template.
 * Handles changes to name, category, body, header, footer.
 *
 * @module whatsapp/application/use-cases
 */

import { ITemplateRepository } from '../../domain/repositories/ITemplateRepository';
import { WhatsAppTemplate } from '../../domain/entities/WhatsAppTemplate';
import { NotFoundError } from '@shared/errors';

/**
 * Update template request DTO.
 */
export interface UpdateTemplateRequest {
  /** Template ID */
  id: string;
  /** Template name */
  name?: string;
  /** Template body text */
  body?: string;
  /** Footer text */
  footerText?: string;
  /** Language */
  language?: string;
  /** Category */
  category?: string;
}

/**
 * Update template response DTO.
 */
export interface UpdateTemplateResponse {
  template: WhatsAppTemplate;
  updatedAt: Date;
}

/**
 * Update Template Use-Case.
 *
 * Application service for updating a WhatsApp message template.
 *
 * @class UpdateTemplate
 */
export class UpdateTemplate {
  constructor(private readonly templateRepository: ITemplateRepository) {}

  /**
   * Execute use-case.
   *
   * @param request - Update template request
   * @returns Promise resolving to update result
   * @throws {NotFoundError} If template not found
   * @throws {Error} If template validation fails
   */
  async execute(request: UpdateTemplateRequest): Promise<UpdateTemplateResponse> {
    const template = await this.templateRepository.findById(request.id);

    if (!template) {
      throw new NotFoundError('Template', request.id);
    }

    // Apply updates (create new instance with updated values)
    const updated = new WhatsAppTemplate(
      template.id,
      request.name ?? template.name,
      request.language ?? template.language as any,
      request.category ?? template.category as any,
      template.getStatus(),
      template.headerType,
      request.body ?? template.bodyText,
      template.createdAt,
      new Date(), // Updated now
      template.headerContent,
      request.footerText ?? template.footerText,
      template.buttons,
      template.getWhatsAppTemplateId(),
      template.getSubmittedAt(),
      template.getApprovedAt(),
      template.getRejectedReason(),
      template.getRequiredParams(),
      template.isActive,
      template.getUsageCount(),
    );

    // Validate the updated template
    updated.validate();

    const saved = await this.templateRepository.save(updated);

    return {
      template: saved,
      updatedAt: new Date(),
    };
  }
}
