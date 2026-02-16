/**
 * Email Template Registry and Renderer
 *
 * @module templates
 * Provides centralized management of email templates with support for
 * Handlebars-compatible variable substitution and compilation
 */

import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';

/**
 * Template metadata
 */
export interface TemplateMetadata {
  /** Template file name */
  filename: string;
  /** Full path to template file */
  path: string;
  /** Template display name */
  name: string;
  /** Template description */
  description: string;
}

/**
 * Template rendering options
 */
export interface RenderOptions {
  /** Whether to cache compiled templates (default: true) */
  cache?: boolean;
  /** Handlebars data object */
  data?: Record<string, any>;
  /** Additional Handlebars helpers */
  helpers?: Record<string, Function>;
}

/**
 * Template rendering result
 */
export interface RenderResult {
  /** Rendered HTML content */
  html: string;
  /** Template metadata */
  metadata: TemplateMetadata;
  /** Rendering timestamp */
  renderedAt: Date;
}

/**
 * Email template registry mapping template names to file paths
 * All templates are located in the same directory as this file
 */
export const TEMPLATE_REGISTRY: Record<string, TemplateMetadata> = {
  'order-confirmation': {
    filename: 'order-confirmation.html',
    path: path.join(__dirname, 'order-confirmation.html'),
    name: 'Order Confirmation',
    description: 'Sent when order is confirmed - includes items list, total, and delivery info',
  },
  'shipping-notification': {
    filename: 'shipping-notification.html',
    path: path.join(__dirname, 'shipping-notification.html'),
    name: 'Shipping Notification',
    description: 'Sent when order ships - includes tracking number and estimated delivery',
  },
  'invoice': {
    filename: 'invoice.html',
    path: path.join(__dirname, 'invoice.html'),
    name: 'Invoice',
    description: 'Detailed invoice with payment info and SmartBill integration data',
  },
  'quotation': {
    filename: 'quotation.html',
    path: path.join(__dirname, 'quotation.html'),
    name: 'Quotation',
    description: 'Quote details with validity period and accept button',
  },
  'b2b-approval': {
    filename: 'b2b-approval.html',
    path: path.join(__dirname, 'b2b-approval.html'),
    name: 'B2B Account Approved',
    description: 'Sent when B2B registration is approved with welcome and next steps',
  },
  'b2b-rejection': {
    filename: 'b2b-rejection.html',
    path: path.join(__dirname, 'b2b-rejection.html'),
    name: 'B2B Account Rejected',
    description: 'Sent when B2B registration is rejected with reason and contact info',
  },
  'low-stock-alert': {
    filename: 'low-stock-alert.html',
    path: path.join(__dirname, 'low-stock-alert.html'),
    name: 'Low Stock Alert',
    description: 'Admin alert when inventory drops below minimum threshold',
  },
  'welcome': {
    filename: 'welcome.html',
    path: path.join(__dirname, 'welcome.html'),
    name: 'Welcome Email',
    description: 'Welcome email for new customers with benefits and getting started info',
  },
  'password-reset': {
    filename: 'password-reset.html',
    path: path.join(__dirname, 'password-reset.html'),
    name: 'Password Reset',
    description: 'Password reset link and security recommendations',
  },
  'base-layout': {
    filename: 'base-layout.html',
    path: path.join(__dirname, 'base-layout.html'),
    name: 'Base Layout',
    description: 'Base template with header/footer and Ledux.ro branding',
  },
};

/**
 * In-memory cache for compiled templates
 */
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

/**
 * Get a template metadata by name
 *
 * @param templateName - Name of the template (e.g., 'order-confirmation')
 * @returns Template metadata or undefined if not found
 */
export function getTemplateMetadata(templateName: string): TemplateMetadata | undefined {
  return TEMPLATE_REGISTRY[templateName];
}

/**
 * Get all available template names
 *
 * @returns Array of template names in registry
 */
export function getAvailableTemplates(): string[] {
  return Object.keys(TEMPLATE_REGISTRY);
}

/**
 * Check if a template exists in the registry
 *
 * @param templateName - Name of the template to check
 * @returns True if template exists
 */
export function hasTemplate(templateName: string): boolean {
  return templateName in TEMPLATE_REGISTRY;
}

/**
 * Load and compile a template
 *
 * @param templateName - Name of the template
 * @param useCache - Whether to use cached version if available (default: true)
 * @returns Compiled Handlebars template function
 * @throws Error if template not found or cannot be read
 *
 * @example
 * ```typescript
 * const template = loadTemplate('order-confirmation');
 * ```
 */
export function loadTemplate(
  templateName: string,
  useCache: boolean = true
): HandlebarsTemplateDelegate {
  // Check cache first
  if (useCache && templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }

  const metadata = getTemplateMetadata(templateName);
  if (!metadata) {
    throw new Error(`Template not found: ${templateName}`);
  }

  try {
    const content = fs.readFileSync(metadata.path, 'utf-8');
    const compiled = Handlebars.compile(content);

    // Cache the compiled template
    if (useCache) {
      templateCache.set(templateName, compiled);
    }

    return compiled;
  } catch (error) {
    throw new Error(`Failed to load template "${templateName}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Register a Handlebars helper
 *
 * @param name - Helper name
 * @param fn - Helper function
 *
 * @example
 * ```typescript
 * registerHelper('currency', (value) => {
 *   return new Intl.NumberFormat('ro-RO', {
 *     style: 'currency',
 *     currency: 'RON'
 *   }).format(value);
 * });
 * ```
 */
export function registerHelper(name: string, fn: Handlebars.HelperDelegate | Function): void {
  Handlebars.registerHelper(name, fn as any);
}

/**
 * Register partial template
 *
 * @param name - Partial name
 * @param partial - Partial template content or name
 *
 * @example
 * ```typescript
 * registerPartial('footer', footerContent);
 * ```
 */
export function registerPartial(name: string, partial: string): void {
  Handlebars.registerPartial(name, partial);
}

/**
 * Render a template with variables
 *
 * @param templateName - Name of the template to render
 * @param variables - Variables to inject into template (Handlebars context)
 * @param options - Additional rendering options
 * @returns Rendered HTML and metadata
 * @throws Error if template cannot be rendered
 *
 * @example
 * ```typescript
 * const result = renderTemplate('order-confirmation', {
 *   customerName: 'John Doe',
 *   orderNumber: 'ORD-123456',
 *   items: [
 *     { name: 'LED Bulb', quantity: 2, unitPrice: '50 RON', total: '100 RON' }
 *   ],
 *   totalPrice: '100 RON',
 *   orderDate: new Date().toISOString(),
 *   currentYear: new Date().getFullYear(),
 * });
 *
 * console.log(result.html);
 * ```
 */
export function renderTemplate(
  templateName: string,
  variables: Record<string, any> = {},
  options: RenderOptions = {}
): RenderResult {
  try {
    // Load template
    const template = loadTemplate(templateName, options.cache !== false);

    // Register custom helpers if provided
    if (options.helpers) {
      Object.entries(options.helpers).forEach(([name, fn]) => {
        registerHelper(name, fn);
      });
    }

    // Merge template variables with options
    const context = {
      ...variables,
      ...(options.data || {}),
    };

    // Render template
    const html = template(context);

    return {
      html,
      metadata: getTemplateMetadata(templateName)!,
      renderedAt: new Date(),
    };
  } catch (error) {
    throw new Error(
      `Failed to render template "${templateName}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Render multiple templates in batch
 *
 * @param templates - Array of template requests
 * @param options - Shared rendering options
 * @returns Array of rendered results
 *
 * @example
 * ```typescript
 * const results = renderMultiple([
 *   { name: 'order-confirmation', variables: { customerName: 'John' } },
 *   { name: 'welcome', variables: { customerName: 'Jane' } }
 * ]);
 * ```
 */
export function renderMultiple(
  templates: Array<{ name: string; variables: Record<string, any> }>,
  options: RenderOptions = {}
): RenderResult[] {
  return templates.map(({ name, variables }) => renderTemplate(name, variables, options));
}

/**
 * Clear the template cache
 * Useful for development and testing
 */
export function clearCache(): void {
  templateCache.clear();
}

/**
 * Get cache statistics
 *
 * @returns Cache info
 *
 * @example
 * ```typescript
 * const stats = getCacheStats();
 * console.log(`Cached templates: ${stats.cachedCount}`);
 * ```
 */
export function getCacheStats(): {
  cachedCount: number;
  cachedTemplates: string[];
} {
  return {
    cachedCount: templateCache.size,
    cachedTemplates: Array.from(templateCache.keys()),
  };
}

/**
 * Setup default Handlebars helpers for common operations
 * Should be called once during application initialization
 *
 * @example
 * ```typescript
 * setupDefaultHelpers();
 * ```
 */
export function setupDefaultHelpers(): void {
  // Format currency (assumes RON)
  registerHelper('currency', function (value: number) {
    if (typeof value !== 'number') return value;
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: 'RON',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  });

  // Format date
  registerHelper('formatDate', function (date: Date | string, format: string = 'DD/MM/YYYY') {
    try {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();

      return format.replace('DD', day).replace('MM', month).replace('YYYY', String(year));
    } catch {
      return date;
    }
  });

  // Calculate discount percentage
  registerHelper('discountPercent', function (original: number, discounted: number) {
    if (original <= 0) return '0%';
    const percent = ((original - discounted) / original) * 100;
    return Math.round(percent) + '%';
  });

  // Check equality
  registerHelper('eq', function (a: any, b: any) {
    return a === b;
  });

  // Math operations
  registerHelper('add', function (a: number, b: number) {
    return a + b;
  });

  registerHelper('subtract', function (a: number, b: number) {
    return a - b;
  });

  registerHelper('multiply', function (a: number, b: number) {
    return a * b;
  });

  registerHelper('divide', function (a: number, b: number) {
    return b !== 0 ? a / b : 0;
  });
}

// Initialize default helpers on module load
setupDefaultHelpers();

export default {
  TEMPLATE_REGISTRY,
  getTemplateMetadata,
  getAvailableTemplates,
  hasTemplate,
  loadTemplate,
  registerHelper,
  registerPartial,
  renderTemplate,
  renderMultiple,
  clearCache,
  getCacheStats,
  setupDefaultHelpers,
};
