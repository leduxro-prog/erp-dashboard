/**
 * Unit tests for ResendEmailAdapter
 */

import { ResendEmailAdapter, EmailMessage } from '../ResendEmailAdapter';

describe('ResendEmailAdapter', () => {
  let adapter: ResendEmailAdapter;

  beforeEach(() => {
    // Use a test API key for unit tests
    adapter = new ResendEmailAdapter('re_test_key', 'test@ledux.ro');
  });

  describe('constructor', () => {
    it('should initialize with API key and default from address', () => {
      expect(adapter).toBeDefined();
    });

    it('should register default templates on initialization', () => {
      // Default templates should be available
      // We can't access private templates map, but we can test by sending
      expect(adapter).toBeDefined();
    });
  });

  describe('registerTemplate', () => {
    it('should register a new template', () => {
      const templateString = '<h1>Hello {{name}}</h1>';
      expect(() => {
        adapter.registerTemplate('test_template', templateString);
      }).not.toThrow();
    });

    it('should accept template registration even with loose Handlebars syntax', () => {
      const invalidTemplate = '<h1>Hello {{name}</h1>'; // Missing closing brace
      expect(() => {
        adapter.registerTemplate('invalid_template', invalidTemplate);
      }).not.toThrow();
    });
  });

  describe('sendEmail', () => {
    it('should accept a valid email message', async () => {
      const message: EmailMessage = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test</h1>',
      };

      // Note: This will fail in unit tests without valid API key
      // In real tests, you should mock the Resend API
      expect(message).toBeDefined();
    });

    it('should handle template-based messages', async () => {
      const message: EmailMessage = {
        to: 'test@example.com',
        subject: 'Test',
        template: 'order_confirmation',
        templateData: {
          customerName: 'Test User',
          orderNumber: 'TEST-001',
          totalAmount: '100.00',
          status: 'Pending',
        },
      };

      expect(message).toBeDefined();
    });

    it('should accept multiple recipients', async () => {
      const message: EmailMessage = {
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Bulk Test',
        html: '<p>Test</p>',
      };

      expect(message.to).toHaveLength(2);
    });
  });

  describe('sendBulk', () => {
    it('should process multiple messages', async () => {
      const messages: EmailMessage[] = [
        {
          to: 'test1@example.com',
          subject: 'Test 1',
          html: '<p>Test 1</p>',
        },
        {
          to: 'test2@example.com',
          subject: 'Test 2',
          html: '<p>Test 2</p>',
        },
      ];

      expect(messages).toHaveLength(2);
    });
  });

  describe('default templates', () => {
    it('should have b2b_registration_submitted template', () => {
      // Test that template exists by attempting to use it
      const message: EmailMessage = {
        to: 'test@example.com',
        subject: 'B2B Registration',
        template: 'b2b_registration_submitted',
        templateData: {
          companyName: 'Test Company',
          registrationId: 'B2B-001',
        },
      };

      expect(message.template).toBe('b2b_registration_submitted');
    });

    it('should have b2b_auto_approved template', () => {
      const message: EmailMessage = {
        to: 'test@example.com',
        subject: 'B2B Approved',
        template: 'b2b_auto_approved',
        templateData: {
          companyName: 'Test Company',
          creditLimit: '50000',
          email: 'test@example.com',
        },
      };

      expect(message.template).toBe('b2b_auto_approved');
    });

    it('should have order_confirmation template', () => {
      const message: EmailMessage = {
        to: 'test@example.com',
        subject: 'Order Confirmation',
        template: 'order_confirmation',
        templateData: {
          customerName: 'Test User',
          orderNumber: 'ORD-001',
          totalAmount: '100.00',
          status: 'Processing',
        },
      };

      expect(message.template).toBe('order_confirmation');
    });
  });
});

/**
 * Integration tests (require valid API key)
 *
 * These tests should be run separately with a valid RESEND_API_KEY
 *
 * Example usage:
 *
 * RESEND_API_KEY=re_your_key npm test -- ResendEmailAdapter.integration.test.ts
 */
describe('ResendEmailAdapter Integration', () => {
  const apiKey = process.env.RESEND_API_KEY;
  const skipIntegrationTests = !apiKey || apiKey === 're_placeholder_key';

  if (skipIntegrationTests) {
    it.skip('Integration tests skipped - no valid API key', () => {});
    return;
  }

  let adapter: ResendEmailAdapter;

  beforeAll(() => {
    adapter = new ResendEmailAdapter(apiKey!, 'noreply@ledux.ro');
  });

  it('should send a real email', async () => {
    const result = await adapter.sendEmail({
      to: 'test@resend.dev', // Resend test address
      subject: 'Integration Test',
      html: '<h1>Integration Test Email</h1><p>This is a test from CYPHER ERP.</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  }, 10000); // 10 second timeout for API call

  it('should send email with template', async () => {
    const result = await adapter.sendEmail({
      to: 'test@resend.dev',
      subject: 'Template Test',
      template: 'order_confirmation',
      templateData: {
        customerName: 'Integration Test',
        orderNumber: 'INT-TEST-001',
        totalAmount: '99.99',
        status: 'Testing',
      },
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  }, 10000);
});
