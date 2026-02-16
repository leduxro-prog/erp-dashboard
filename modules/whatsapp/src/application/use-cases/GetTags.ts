/**
 * Get Tags Use-Case
 *
 * Retrieves all available conversation tags.
 *
 * @module whatsapp/application/use-cases
 */

import { ITagRepository } from '../../domain/repositories/ITagRepository';

/**
 * Get tags response DTO.
 */
export interface GetTagsResponse {
  tags: Array<{
    id: string;
    name: string;
    color: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

/**
 * Get Tags Use-Case.
 *
 * Application service for retrieving all conversation tags.
 *
 * @class GetTags
 */
export class GetTags {
  constructor(private readonly tagRepository: ITagRepository) {}

  /**
   * Execute use-case.
   *
   * @returns Promise resolving to tags list
   */
  async execute(): Promise<GetTagsResponse> {
    const tags = await this.tagRepository.findAll();

    return {
      tags: tags.map((tag) => tag.toJSON()),
    };
  }
}
