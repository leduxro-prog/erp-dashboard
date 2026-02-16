/**
 * WhatsApp Tag Domain Entity
 *
 * Represents a tag for categorizing conversations.
 *
 * @module whatsapp/domain/entities
 */

/**
 * WhatsApp Tag entity.
 *
 * Core domain entity for conversation tags.
 * Tags are used for categorization and filtering.
 *
 * @class WhatsAppTag
 */
export class WhatsAppTag {
  /**
   * Create a new WhatsApp tag.
   *
   * @param id - Unique tag ID
   * @param name - Tag name
   * @param color - Hex color code for UI display
   * @param createdAt - Tag creation timestamp
   * @param updatedAt - Last update timestamp
   */
  constructor(
    readonly id: string,
    private name: string,
    private color: string,
    readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date(),
  ) {}

  /**
   * Update tag properties.
   *
   * @param name - New name
   * @param color - New color
   */
  update(name?: string, color?: string): void {
    if (name) {
      this.name = name;
    }
    if (color) {
      this.color = color;
    }
    this.updatedAt = new Date();
  }

  /**
   * Get tag name.
   * @internal
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get tag color.
   * @internal
   */
  getColor(): string {
    return this.color;
  }

  /**
   * Convert to plain object for API responses.
   *
   * @returns Plain object representation
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
