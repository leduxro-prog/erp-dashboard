/**
 * StructuredDataGenerator Service
 *
 * Generates JSON-LD structured data (schema.org) for products, categories, pages, and organizations.
 * Creates valid schema.org markup for search engine understanding.
 *
 * ### Generated Schema Types
 * - Product: Full product schema with price, availability, image, review
 * - Organization: Company information (Ledux.ro)
 * - BreadcrumbList: Navigation path from home to product/category
 * - FAQPage: FAQ schema from product descriptions
 * - WebPage: Generic page schema
 * - LocalBusiness: Physical location and contact info
 * - AggregateRating: Combined rating and review count
 *
 * @example
 * const generator = new StructuredDataGenerator('https://ledux.ro');
 * const productSchema = generator.generateProduct({
 *   id: 'prod-123',
 *   name: 'Bec LED 10W',
 *   price: 25.99,
 *   currency: 'RON',
 *   description: 'High-quality LED bulb',
 *   imageUrl: 'https://ledux.ro/images/bec-led-10w.jpg',
 *   availability: 'https://schema.org/InStock',
 *   brand: 'Ledux',
 *   sku: 'BEC-LED-10W',
 * });
 */

/**
 * Product data for schema generation
 */
export interface ProductSchemaData {
  id: string;
  name: string;
  description: string;
  price: number;
  currency?: string;
  imageUrl?: string;
  availability?: string;
  brand?: string;
  sku?: string;
  category?: string;
  ratingValue?: number;
  ratingCount?: number;
  url?: string;
}

/**
 * Breadcrumb data for schema generation
 */
export interface BreadcrumbSchemaData {
  items: Array<{
    name: string;
    url: string;
  }>;
}

/**
 * Organization data for schema generation
 */
export interface OrganizationSchemaData {
  name: string;
  url: string;
  logo?: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

/**
 * StructuredDataGenerator - Domain Service
 *
 * Generates valid JSON-LD structured data for various schema types.
 */
export class StructuredDataGenerator {
  /**
   * Base URL for the website
   */
  private readonly baseUrl: string;

  /**
   * Create a new StructuredDataGenerator
   *
   * @param baseUrl - Base URL of the website (e.g., https://ledux.ro)
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate Product schema
   *
   * Creates complete JSON-LD for an e-commerce product.
   *
   * @param product - Product data
   * @returns JSON-LD object for Product schema
   */
  generateProduct(product: ProductSchemaData): Record<string, unknown> {
    const schema: Record<string, unknown> = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      url: product.url || `${this.baseUrl}/products/${product.id}`,
      image: product.imageUrl || `${this.baseUrl}/images/product-placeholder.jpg`,
      sku: product.sku || product.id,
      brand: {
        '@type': 'Brand',
        name: product.brand || 'Ledux',
      },
      offers: {
        '@type': 'Offer',
        url: product.url || `${this.baseUrl}/products/${product.id}`,
        priceCurrency: product.currency || 'RON',
        price: product.price.toString(),
        availability: product.availability || 'https://schema.org/InStock',
      },
    };

    // Add category if provided
    if (product.category) {
      schema.category = product.category;
    }

    // Add rating if provided
    if (product.ratingValue && product.ratingCount) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: product.ratingValue.toString(),
        ratingCount: product.ratingCount.toString(),
      };
    }

    return schema;
  }

  /**
   * Generate Organization schema
   *
   * Creates JSON-LD for company/organization information.
   *
   * @param organization - Organization data
   * @returns JSON-LD object for Organization schema
   */
  generateOrganization(organization: OrganizationSchemaData): Record<string, unknown> {
    const schema: Record<string, unknown> = {
      '@context': 'https://schema.org/',
      '@type': 'Organization',
      name: organization.name,
      url: organization.url || this.baseUrl,
      logo: organization.logo || `${this.baseUrl}/logo.png`,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'Sales',
      },
    };

    // Add contact information if provided
    if (organization.email) {
      (schema.contactPoint as Record<string, unknown>).email = organization.email;
    }
    if (organization.phone) {
      (schema.contactPoint as Record<string, unknown>).telephone = organization.phone;
    }

    // Add address if provided
    if (organization.address) {
      schema.address = {
        '@type': 'PostalAddress',
        streetAddress: organization.address.street,
        addressLocality: organization.address.city,
        postalCode: organization.address.postalCode,
        addressCountry: organization.address.country,
      };
    }

    return schema;
  }

  /**
   * Generate BreadcrumbList schema
   *
   * Creates JSON-LD for navigation breadcrumbs.
   *
   * @param breadcrumbs - Breadcrumb items
   * @returns JSON-LD object for BreadcrumbList schema
   */
  generateBreadcrumbList(breadcrumbs: BreadcrumbSchemaData): Record<string, unknown> {
    const itemListElement = breadcrumbs.items.map((item, index) => ({
      '@type': 'ListItem',
      position: (index + 1).toString(),
      name: item.name,
      item: item.url,
    }));

    return {
      '@context': 'https://schema.org/',
      '@type': 'BreadcrumbList',
      itemListElement,
    };
  }

  /**
   * Generate WebPage schema
   *
   * Creates basic JSON-LD for a web page.
   *
   * @param title - Page title
   * @param description - Page description
   * @param url - Page URL
   * @returns JSON-LD object for WebPage schema
   */
  generateWebPage(
    title: string,
    description: string,
    url: string
  ): Record<string, unknown> {
    return {
      '@context': 'https://schema.org/',
      '@type': 'WebPage',
      name: title,
      description,
      url,
      isPartOf: {
        '@id': this.baseUrl,
      },
    };
  }

  /**
   * Generate FAQPage schema
   *
   * Creates JSON-LD for frequently asked questions.
   *
   * @param faqs - Array of FAQ items
   * @returns JSON-LD object for FAQPage schema
   */
  generateFAQPage(
    faqs: Array<{ question: string; answer: string }>
  ): Record<string, unknown> {
    const mainEntity = faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    }));

    return {
      '@context': 'https://schema.org/',
      '@type': 'FAQPage',
      mainEntity,
    };
  }

  /**
   * Generate LocalBusiness schema
   *
   * Creates JSON-LD for a physical business location.
   *
   * @param name - Business name
   * @param address - Business address
   * @param phone - Business phone
   * @param email - Business email
   * @returns JSON-LD object for LocalBusiness schema
   */
  generateLocalBusiness(
    name: string,
    address: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    },
    phone?: string,
    email?: string
  ): Record<string, unknown> {
    const schema: Record<string, unknown> = {
      '@context': 'https://schema.org/',
      '@type': 'LocalBusiness',
      name,
      url: this.baseUrl,
      address: {
        '@type': 'PostalAddress',
        streetAddress: address.street,
        addressLocality: address.city,
        postalCode: address.postalCode,
        addressCountry: address.country,
      },
    };

    if (phone) {
      schema.telephone = phone;
    }
    if (email) {
      schema.email = email;
    }

    return schema;
  }

  /**
   * Generate AggregateRating schema
   *
   * Creates JSON-LD for aggregate product rating.
   *
   * @param name - Product or entity name
   * @param ratingValue - Average rating (0-5)
   * @param ratingCount - Number of ratings
   * @returns JSON-LD object for AggregateRating schema
   */
  generateAggregateRating(
    name: string,
    ratingValue: number,
    ratingCount: number
  ): Record<string, unknown> {
    return {
      '@context': 'https://schema.org/',
      '@type': 'AggregateRating',
      name,
      ratingValue: ratingValue.toString(),
      ratingCount: ratingCount.toString(),
    };
  }

  /**
   * Convert schema object to JSON-LD string
   *
   * Formats schema for embedding in HTML <script> tag.
   *
   * @param schema - Schema object
   * @returns JSON string suitable for HTML embedding
   */
  toJsonString(schema: Record<string, unknown>): string {
    return JSON.stringify(schema, null, 2);
  }

  /**
   * Generate HTML script tag for schema
   *
   * Creates complete script tag ready to embed in HTML.
   *
   * @param schema - Schema object
   * @returns HTML script tag
   */
  toHtmlScript(schema: Record<string, unknown>): string {
    const jsonString = this.toJsonString(schema);
    return `<script type="application/ld+json">\n${jsonString}\n</script>`;
  }
}
