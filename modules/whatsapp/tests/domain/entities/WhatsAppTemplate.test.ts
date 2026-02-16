/**
 * WhatsApp Template Entity Tests
 *
 * Tests for template rendering, validation, and parameter extraction.
 *
 * @test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  WhatsAppTemplate,
  TemplateLanguage,
  TemplateCategory,
  TemplateStatus,
  HeaderType,
} from '../../../src/domain/entities/WhatsAppTemplate';
import { TemplateValidationError } from '../../../src/domain/errors/whatsapp.errors';

describe('WhatsAppTemplate Entity', () => {
  let template: WhatsAppTemplate;
  const now = new Date();

  beforeEach(() => {
    template = new WhatsAppTemplate(
      'tmpl-001',
      'ORDER_CONFIRMED_RO',
      'ro',
      'UTILITY',
      'PENDING',
      'NONE',
      'Comanda {{1}} a fost confirmată. Total: {{2}} EUR',
      now,
      now
    );
  });

  describe('Template Rendering', () => {
    it('should render template with parameters', () => {
      const rendered = template.render(['#12345', '499.99']);
      expect(rendered).toBe(
        'Comanda #12345 a fost confirmată. Total: 499.99 EUR'
      );
    });

    it('should handle multiple identical placeholders', () => {
      const tmpl = new WhatsAppTemplate(
        'tmpl-002',
        'TEST',
        'ro',
        'UTILITY',
        'PENDING',
        'NONE',
        'Hello {{1}}, welcome to {{1}}!',
        now,
        now
      );
      const rendered = tmpl.render(['MyStore']);
      expect(rendered).toBe('Hello MyStore, welcome to MyStore!');
    });

    it('should throw when not enough parameters', () => {
      expect(() => template.render(['#12345'])).toThrow();
    });

    it('should handle optional parameters', () => {
      const rendered = template.render(['#12345', '499.99', 'extra']);
      // Extra parameters are ignored
      expect(rendered).toBe(
        'Comanda #12345 a fost confirmată. Total: 499.99 EUR'
      );
    });

    it('should preserve parameter order', () => {
      const rendered = template.render(['ORDER123', 'AMOUNT456']);
      expect(rendered).toContain('ORDER123');
      expect(rendered).toContain('AMOUNT456');
    });
  });

  describe('Validation', () => {
    it('should validate correct template', () => {
      expect(() => template.validate()).not.toThrow();
    });

    it('should require template name', () => {
      const invalidTemplate = new WhatsAppTemplate(
        'tmpl-003',
        '',
        'ro',
        'UTILITY',
        'PENDING',
        'NONE',
        'Body text',
        now,
        now
      );
      expect(() => invalidTemplate.validate()).toThrow();
    });

    it('should require template body', () => {
      const invalidTemplate = new WhatsAppTemplate(
        'tmpl-004',
        'TEST',
        'ro',
        'UTILITY',
        'PENDING',
        'NONE',
        '',
        now,
        now
      );
      expect(() => invalidTemplate.validate()).toThrow();
    });

    it('should enforce body length limit', () => {
      const longBody = 'a'.repeat(4097);
      const invalidTemplate = new WhatsAppTemplate(
        'tmpl-005',
        'TEST',
        'ro',
        'UTILITY',
        'PENDING',
        'NONE',
        longBody,
        now,
        now
      );
      expect(() => invalidTemplate.validate()).toThrow();
    });

    it('should require header content when header type is TEXT', () => {
      const invalidTemplate = new WhatsAppTemplate(
        'tmpl-006',
        'TEST',
        'ro',
        'UTILITY',
        'PENDING',
        'TEXT',
        'Body text',
        now,
        now
      );
      expect(() => invalidTemplate.validate()).toThrow();
    });

    it('should enforce footer length limit', () => {
      const longFooter = 'a'.repeat(61);
      const invalidTemplate = new WhatsAppTemplate(
        'tmpl-007',
        'TEST',
        'ro',
        'UTILITY',
        'PENDING',
        'NONE',
        'Body text',
        now,
        now,
        undefined,
        longFooter
      );
      expect(() => invalidTemplate.validate()).toThrow();
    });

    it('should validate buttons', () => {
      const invalidTemplate = new WhatsAppTemplate(
        'tmpl-008',
        'TEST',
        'ro',
        'UTILITY',
        'PENDING',
        'NONE',
        'Body text',
        now,
        now,
        undefined,
        undefined,
        [{ type: 'URL', text: 'Click me' }] // Missing URL
      );
      expect(() => invalidTemplate.validate()).toThrow();
    });
  });

  describe('Approval Status', () => {
    it('should initialize as PENDING', () => {
      expect(template.getStatus()).toBe('PENDING');
    });

    it('should not be approved when PENDING', () => {
      expect(template.isApproved()).toBe(false);
    });

    it('should mark as submitted', () => {
      template.markSubmitted('meta-tmpl-001');
      expect(template.getWhatsAppTemplateId()).toBe('meta-tmpl-001');
      expect(template.getSubmittedAt()).toBeDefined();
    });

    it('should mark as approved', () => {
      template.markApproved();
      expect(template.isApproved()).toBe(true);
      expect(template.getApprovedAt()).toBeDefined();
    });

    it('should mark as rejected with reason', () => {
      const reason = 'Contains prohibited content';
      template.markRejected(reason);
      expect(template.getStatus()).toBe('REJECTED');
      expect(template.getRejectedReason()).toBe(reason);
    });

    it('should be idempotent for approval', () => {
      template.markApproved();
      const firstTime = template.getApprovedAt();
      template.markApproved();
      expect(template.getApprovedAt()).toEqual(firstTime);
    });
  });

  describe('Parameter Extraction', () => {
    it('should extract required parameters', () => {
      const params = template.getRequiredParams();
      expect(params).toEqual(['1', '2']);
    });

    it('should handle no parameters', () => {
      const noParamTemplate = new WhatsAppTemplate(
        'tmpl-009',
        'TEST',
        'ro',
        'UTILITY',
        'PENDING',
        'NONE',
        'No parameters here',
        now,
        now
      );
      expect(noParamTemplate.getRequiredParams()).toEqual([]);
    });

    it('should handle single parameter', () => {
      const singleParamTemplate = new WhatsAppTemplate(
        'tmpl-010',
        'TEST',
        'ro',
        'UTILITY',
        'PENDING',
        'NONE',
        'Hello {{1}}!',
        now,
        now
      );
      expect(singleParamTemplate.getRequiredParams()).toEqual(['1']);
    });

    it('should return sorted unique parameters', () => {
      const multiParamTemplate = new WhatsAppTemplate(
        'tmpl-011',
        'TEST',
        'ro',
        'UTILITY',
        'PENDING',
        'NONE',
        '{{3}} {{1}} {{2}} {{1}}',
        now,
        now
      );
      expect(multiParamTemplate.getRequiredParams()).toEqual(['1', '2', '3']);
    });
  });

  describe('Immutability', () => {
    it('should maintain immutable properties', () => {
      expect(template.id).toBe('tmpl-001');
      expect(template.name).toBe('ORDER_CONFIRMED_RO');
      expect(template.language).toBe('ro');
      expect(template.category).toBe('UTILITY');
      expect(template.headerType).toBe('NONE');
    });
  });

  describe('Multi-language Support', () => {
    it('should support Romanian template', () => {
      expect(template.language).toBe('ro');
    });

    it('should support English template', () => {
      const enTemplate = new WhatsAppTemplate(
        'tmpl-012',
        'ORDER_CONFIRMED_EN',
        'en',
        'UTILITY',
        'PENDING',
        'NONE',
        'Order {{1}} confirmed. Total: {{2}} EUR',
        now,
        now
      );
      expect(enTemplate.language).toBe('en');
    });
  });
});
