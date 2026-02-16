import Handlebars from 'handlebars';

/**
 * NotificationTemplate Domain Entity
 * Represents a reusable template for notifications with Handlebars variable interpolation
 *
 * Handles template rendering, variable validation, and template lifecycle management.
 *
 * @class NotificationTemplate
 */
export type TemplateLocale = 'ro' | 'en';

export interface NotificationTemplateProps {
  id?: string;
  name: string;
  slug: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  subject: string;
  body: string;
  locale: TemplateLocale;
  isActive: boolean;
  version: number;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class NotificationTemplate {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
  readonly locale: TemplateLocale;
  readonly version: number;
  readonly createdBy: string;
  readonly createdAt: Date;

  private subject: string;
  private body: string;
  private isActive: boolean;
  private updatedAt: Date;

  private compiledSubject?: HandlebarsTemplateDelegate<unknown>;
  private compiledBody?: HandlebarsTemplateDelegate<unknown>;

  /**
   * Create a new NotificationTemplate entity
   *
   * @param props - Template properties
   * @throws {Error} If required properties are missing or template syntax is invalid
   */
  constructor(props: NotificationTemplateProps) {
    if (!props.id) {
      throw new Error('Template ID is required');
    }
    if (!props.name || !props.slug) {
      throw new Error('Template name and slug are required');
    }
    if (!props.channel) {
      throw new Error('Channel is required');
    }
    if (!props.body) {
      throw new Error('Template body is required');
    }

    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.channel = props.channel;
    this.subject = props.subject;
    this.body = props.body;
    this.locale = props.locale;
    this.isActive = props.isActive;
    this.version = props.version;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();

    // Validate Handlebars syntax on construction
    this.validate();
  }

  /**
   * Validate Handlebars template syntax
   * Compiles templates to catch syntax errors early
   *
   * @throws {Error} If template syntax is invalid
   */
  validate(): void {
    try {
      this.compiledSubject = Handlebars.compile(this.subject);
      this.compiledBody = Handlebars.compile(this.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid Handlebars syntax: ${message}`);
    }
  }

  /**
   * Render template with provided data
   * Validates required variables are present
   *
   * @param data - Object containing template variables
   * @returns Object with rendered subject and body
   * @throws {Error} If required variables are missing
   */
  render(data: Record<string, unknown>): { subject: string; body: string } {
    const required = this.getRequiredVariables();

    // Check all required variables are provided
    const missing = required.filter((v) => !(v in data));
    if (missing.length > 0) {
      throw new Error(
        `Missing required template variables: ${missing.join(', ')}`
      );
    }

    if (!this.compiledSubject || !this.compiledBody) {
      this.validate();
    }

    return {
      subject: this.compiledSubject!(data) as string,
      body: this.compiledBody!(data) as string,
    };
  }

  /**
   * Extract all variables used in template
   * Variables are identified by {{variableName}} syntax
   *
   * @returns Array of variable names (unique, sorted)
   */
  getRequiredVariables(): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables = new Set<string>();

    let match;
    const combined = this.subject + this.body;

    while ((match = regex.exec(combined)) !== null) {
      // Remove Handlebars helpers/logic (if, each, etc.)
      const variable = match[1].trim();
      if (
        !['if', 'else', 'each', 'with', 'unless', '/if', '/each', '/with', '/unless'].includes(
          variable
        )
      ) {
        variables.add(variable.split(' ')[0]); // Get base variable name
      }
    }

    return Array.from(variables).sort();
  }

  /**
   * Get template status
   *
   * @returns Whether template is active
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Activate the template
   */
  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  /**
   * Deactivate the template
   */
  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /**
   * Update template content
   *
   * @param subject - New subject template
   * @param body - New body template
   * @throws {Error} If new template syntax is invalid
   */
  updateContent(subject: string, body: string): void {
    // Validate new templates first
    try {
      Handlebars.compile(subject);
      Handlebars.compile(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid Handlebars syntax: ${message}`);
    }

    this.subject = subject;
    this.body = body;
    this.compiledSubject = undefined;
    this.compiledBody = undefined;
    this.updatedAt = new Date();

    // Revalidate with new content
    this.validate();
  }

  /**
   * Get template for JSON serialization
   *
   * @returns Plain object representation
   */
  toJSON(): NotificationTemplateProps {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      channel: this.channel,
      subject: this.subject,
      body: this.body,
      locale: this.locale,
      isActive: this.isActive,
      version: this.version,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
