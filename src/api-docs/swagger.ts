/**
 * OpenAPI 3.0 Specification for CYPHER ERP API
 * 
 * This module defines the complete OpenAPI/Swagger documentation for all CYPHER ERP endpoints.
 * It includes all paths, request/response schemas, security schemes, and examples.
 */

/**
 * OpenAPI 3.0 specification object for CYPHER ERP API
 */
export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'CYPHER ERP API',
    description: 'Comprehensive Enterprise Resource Planning (ERP) API for managing pricing, orders, inventory, quotations, suppliers, integrations, and more.',
    version: '1.0.0',
    contact: {
      name: 'CYPHER ERP Support',
      email: 'support@cypher-erp.com',
      url: 'https://cypher-erp.com',
    },
    license: {
      name: 'Commercial License',
      url: 'https://cypher-erp.com/license',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://api.cypher-erp.com',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Bearer token for authentication',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error', 'message'],
        properties: {
          error: {
            type: 'string',
            description: 'Error code or type',
          },
          message: {
            type: 'string',
            description: 'Human-readable error message',
          },
          details: {
            type: 'object',
            description: 'Additional error details',
          },
        },
      },
      Price: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Product ID' },
          sku: { type: 'string', description: 'Product SKU' },
          basePrice: { type: 'number', description: 'Base price' },
          cost: { type: 'number', description: 'Cost price' },
          marginPercentage: { type: 'number', description: 'Profit margin percentage' },
          categoryId: { type: 'number', description: 'Product category ID' },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check endpoint',
        description: 'Returns API health status',
        tags: ['System'],
        security: [],
        responses: {
          200: {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    environment: { type: 'string', example: 'production' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/docs': {
      get: {
        summary: 'Swagger UI documentation',
        description: 'Interactive API documentation',
        tags: ['Documentation'],
        security: [],
        responses: {
          200: {
            description: 'Swagger UI HTML page',
          },
        },
      },
    },
    '/api/docs/json': {
      get: {
        summary: 'OpenAPI JSON specification',
        description: 'Returns the OpenAPI 3.0 specification in JSON format',
        tags: ['Documentation'],
        security: [],
        responses: {
          200: {
            description: 'OpenAPI specification',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
        },
      },
    },
    '/api/v1/pricing/{productId}': {
      get: {
        summary: 'Get product pricing',
        description: 'Retrieve pricing information for a specific product',
        tags: ['Pricing'],
        parameters: [
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'number' },
            description: 'Product ID',
          },
        ],
        responses: {
          200: {
            description: 'Product pricing',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Price' },
              },
            },
          },
          404: {
            description: 'Product not found',
          },
        },
      },
    },
    '/api/v1/pricing/calculate': {
      post: {
        summary: 'Calculate order pricing',
        tags: ['Pricing'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items'],
                properties: {
                  items: {
                    type: 'array',
                    items: { type: 'object' },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Calculated pricing',
          },
        },
      },
    },
    '/api/v1/orders': {
      get: {
        summary: 'List orders',
        tags: ['Orders'],
        responses: {
          200: {
            description: 'List of orders',
          },
        },
      },
      post: {
        summary: 'Create order',
        tags: ['Orders'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
        responses: {
          201: {
            description: 'Order created',
          },
        },
      },
    },
    '/api/v1/orders/{id}': {
      get: {
        summary: 'Get order by ID',
        tags: ['Orders'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'number' },
          },
        ],
        responses: {
          200: {
            description: 'Order details',
          },
        },
      },
    },
    '/api/v1/inventory/stock/{productId}': {
      get: {
        summary: 'Get product stock levels',
        tags: ['Inventory'],
        parameters: [
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'number' },
          },
        ],
        responses: {
          200: {
            description: 'Stock levels',
          },
        },
      },
    },
    '/api/v1/suppliers': {
      get: {
        summary: 'List suppliers',
        tags: ['Suppliers'],
        responses: {
          200: {
            description: 'List of suppliers',
          },
        },
      },
    },
    '/api/v1/quotations': {
      get: {
        summary: 'List quotations',
        tags: ['Quotations'],
        responses: {
          200: {
            description: 'List of quotations',
          },
        },
      },
    },
    '/api/v1/smartbill/sync': {
      post: {
        summary: 'Sync SmartBill data',
        tags: ['SmartBill'],
        responses: {
          202: {
            description: 'Sync job started',
          },
        },
      },
    },
    '/api/v1/woocommerce/orders/pull': {
      post: {
        summary: 'Pull orders from WooCommerce',
        tags: ['WooCommerce'],
        responses: {
          202: {
            description: 'Order pull started',
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'System',
      description: 'System and health check endpoints',
    },
    {
      name: 'Documentation',
      description: 'API documentation endpoints',
    },
    {
      name: 'Pricing',
      description: 'Product pricing and promotion management',
    },
    {
      name: 'Orders',
      description: 'Sales order management and tracking',
    },
    {
      name: 'Inventory',
      description: 'Stock level and warehouse management',
    },
    {
      name: 'Suppliers',
      description: 'Supplier and procurement management',
    },
    {
      name: 'Quotations',
      description: 'Sales quotation management',
    },
    {
      name: 'SmartBill',
      description: 'SmartBill invoicing integration',
    },
    {
      name: 'WooCommerce',
      description: 'WooCommerce e-commerce integration',
    },
  ],
};

export default openApiSpec;
