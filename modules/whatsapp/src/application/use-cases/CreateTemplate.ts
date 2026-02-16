/**
 * Create Template Use-Case
 *
 * Creates a new WhatsApp message template.
 * Validates template structure before persisting.
 *
 * @module whatsapp/application/use-cases
 */

import { ITemplateRepository } from '../../domain/repositories/ITemplateRepository';
import {
  WhatsAppTemplate,
  TemplateCategory,
  TemplateLanguage,
} from '../../domain/entities/WhatsAppTemplate';

/**
 * Create template request DTO.
 */
export interface CreateTemplateRequest {
  /** Template name */
  name: string;
  /** Template body content with {{1}} placeholders */
  content: string;
  /** Template category (default: UTILITY) */
  category?: string;
  /** Language code (default: ro) */
  language?: string;
  /** Parameter names for documentation */
  parameters?: string[];
}

/**
 * Create Template Use-Case.
 *
 * Application service for creating WhatsApp message templates.
 *
 * @class CreateTemplate
 */
export class CreateTemplate {
  constructor(private readonly templateRepository: ITemplateRepository) {}

  /**
   * Execute the use-case.
   *
   * @param request - Create template request
   * @returns Promise resolving to created template
   * @throws {Error} If template validation fails
   */
  async execute(request: CreateTemplateRequest): Promise<WhatsAppTemplate> {
    const templateId = this.generateId();

    const template = new WhatsAppTemplate(
      templateId,
      request.name,
      (request.language || 'ro') as TemplateLanguage,
      (request.category || 'UTILITY') as TemplateCategory,
      'PENDING',
      'NONE',
      request.content,
      new Date(),
      new Date(),
      undefined,
      undefined,
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      request.parameters || [],
    );

    // Validate template structure
    template.validate();

    // Save and return
    return this.templateRepository.save(template);
  }

  /**
   * Generate unique ID.
   * @internal
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
