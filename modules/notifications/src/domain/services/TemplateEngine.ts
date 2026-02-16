/**
 * Template Engine Domain Service
 * Renders Handlebars templates with data and validates required variables
 *
 * Pure domain service - no I/O, no repository access.
 *
 * @class TemplateEngine
 */
import { NotificationTemplate } from '../entities/NotificationTemplate';
import { Logger } from 'winston';

export interface TemplateRenderResult {
  subject: string;
  body: string;
  requiredVariables: string[];
}

export class TemplateEngine {
  private logger: Logger;

  /**
   * Create a new TemplateEngine
   *
   * @param logger - Winston logger instance
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Render a template with provided data
   * Validates that all required variables are present
   *
   * @param template - NotificationTemplate entity
   * @param data - Data object for template variables
   * @returns Rendered subject and body with required variables list
   * @throws {Error} If required variables are missing or rendering fails
   */
  render(
    template: NotificationTemplate,
    data: Record<string, unknown>
  ): TemplateRenderResult {
    const requiredVariables = template.getRequiredVariables();

    this.logger.debug(`Rendering template`, {
      templateId: template.id,
      templateSlug: template.slug,
      requiredVariables,
      providedKeys: Object.keys(data),
    });

    // Check all required variables are provided
    const missing = requiredVariables.filter((v) => !(v in data));
    if (missing.length > 0) {
      const error = new Error(
        `Missing required template variables: ${missing.join(', ')}`
      );
      this.logger.error(`Template render failed: missing variables`, {
        templateId: template.id,
        missing,
      });
      throw error;
    }

    try {
      const rendered = template.render(data);

      this.logger.debug(`Template rendered successfully`, {
        templateId: template.id,
        subjectLength: rendered.subject.length,
        bodyLength: rendered.body.length,
      });

      return {
        subject: rendered.subject,
        body: rendered.body,
        requiredVariables,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Template rendering failed`, {
        templateId: template.id,
        error: message,
      });
      throw error;
    }
  }

  /**
   * Get all variables required by a template
   *
   * @param template - NotificationTemplate entity
   * @returns Array of variable names
   */
  getRequiredVariables(template: NotificationTemplate): string[] {
    return template.getRequiredVariables();
  }

  /**
   * Validate that data contains all required variables
   *
   * @param template - NotificationTemplate entity
   * @param data - Data object to validate
   * @returns Object with isValid flag and missing variables array
   */
  validateData(
    template: NotificationTemplate,
    data: Record<string, unknown>
  ): { isValid: boolean; missing: string[] } {
    const required = template.getRequiredVariables();
    const missing = required.filter((v) => !(v in data));

    return {
      isValid: missing.length === 0,
      missing,
    };
  }

  /**
   * Check if template has valid Handlebars syntax
   *
   * @param template - NotificationTemplate entity
   * @returns True if template is valid
   */
  isTemplateValid(template: NotificationTemplate): boolean {
    try {
      template.validate();
      return true;
    } catch {
      return false;
    }
  }
}
