/**
 * List Templates Use-Case
 *
 * Lists WhatsApp message templates with filtering and pagination.
 *
 * @module whatsapp/application/use-cases
 */

import { ITemplateRepository } from '../../domain/repositories/ITemplateRepository';
import { PaginatedResult } from '../../domain/repositories/IMessageRepository';
import { WhatsAppTemplate, TemplateStatus } from '../../domain/entities/WhatsAppTemplate';

/**
 * List templates request DTO.
 */
export interface ListTemplatesRequest {
  /** Filter by template status */
  status?: string;
  /** Search by template name */
  search?: string;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
}

/**
 * List Templates Use-Case.
 *
 * Application service for listing WhatsApp message templates.
 *
 * @class ListTemplates
 */
export class ListTemplates {
  constructor(private readonly templateRepository: ITemplateRepository) {}

  /**
   * Execute the use-case.
   *
   * @param request - List templates request
   * @returns Promise resolving to paginated template results
   */
  async execute(request: ListTemplatesRequest): Promise<PaginatedResult<WhatsAppTemplate>> {
    const page = request.page ?? 1;
    const limit = request.limit ?? 20;
    const offset = (page - 1) * limit;

    // If status is APPROVED, use the specialized method
    if (request.status === 'APPROVED') {
      return this.templateRepository.findApproved({ limit, offset });
    }

    return this.templateRepository.findAll({ limit, offset });
  }
}
