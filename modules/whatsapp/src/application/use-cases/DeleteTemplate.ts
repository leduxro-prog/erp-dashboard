/**
 * Delete Template Use-Case
 *
 * Deletes a WhatsApp message template.
 * Handles both soft delete (deactivation) and hard delete.
 *
 * @module whatsapp/application/use-cases
 */

import { ITemplateRepository } from '../../domain/repositories/ITemplateRepository';
import { NotFoundError } from '@shared/errors';

/**
 * Delete template request DTO.
 */
export interface DeleteTemplateRequest {
  /** Template ID */
  id: string;
}

/**
 * Delete template response DTO.
 */
export interface DeleteTemplateResponse {
  templateId: string;
  deletedAt: Date;
}

/**
 * Delete Template Use-Case.
 *
 * Application service for deleting a WhatsApp message template.
 *
 * @class DeleteTemplate
 */
export class DeleteTemplate {
  constructor(private readonly templateRepository: ITemplateRepository) {}

  /**
   * Execute use-case.
   *
   * @param request - Delete template request
   * @returns Promise resolving to delete result
   * @throws {NotFoundError} If template not found
   */
  async execute(request: DeleteTemplateRequest): Promise<DeleteTemplateResponse> {
    // Verify template exists before deletion
    const template = await this.templateRepository.findById(request.id);

    if (!template) {
      throw new NotFoundError('Template', request.id);
    }

    // Delete from repository
    await this.templateRepository.delete(request.id);

    return {
      templateId: request.id,
      deletedAt: new Date(),
    };
  }
}
