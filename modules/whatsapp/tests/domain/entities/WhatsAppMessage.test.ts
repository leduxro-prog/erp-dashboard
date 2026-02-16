/**
 * WhatsApp Message Entity Tests
 *
 * Tests for message status transitions, retry logic, and content formatting.
 *
 * @test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  WhatsAppMessage,
  MessageDirection,
  MessageType,
  MessageStatus,
} from '../../../src/domain/entities/WhatsAppMessage';

describe('WhatsAppMessage Entity', () => {
  let message: WhatsAppMessage;

  beforeEach(() => {
    const now = new Date();
    message = new WhatsAppMessage(
      'msg-001',
      'conv-001',
      'OUTBOUND',
      'TEXT',
      '+40723456789',
      '+40701234567',
      'Hello customer',
      'PENDING',
      now,
      now
    );
  });

  describe('Status Transitions', () => {
    it('should mark message as sent', () => {
      message.markSent('wa-msg-001');
      expect(message.getStatus()).toBe('SENT');
      expect(message.getWhatsAppMessageId()).toBe('wa-msg-001');
    });

    it('should mark message as delivered', () => {
      message.markSent('wa-msg-001');
      message.markDelivered();
      expect(message.getStatus()).toBe('DELIVERED');
    });

    it('should mark message as read', () => {
      message.markSent('wa-msg-001');
      message.markDelivered();
      message.markRead();
      expect(message.getStatus()).toBe('READ');
    });

    it('should not allow marking as delivered before sent', () => {
      expect(() => message.markDelivered()).toThrow();
    });

    it('should not allow marking as read before sent', () => {
      expect(() => message.markRead()).toThrow();
    });

    it('should be idempotent for marking sent', () => {
      message.markSent('wa-msg-001');
      message.markSent('wa-msg-002'); // Should not change ID
      expect(message.getWhatsAppMessageId()).toBe('wa-msg-001');
    });

    it('should mark message as failed', () => {
      const error = 'Invalid phone number';
      message.markFailed(error);
      expect(message.getStatus()).toBe('FAILED');
      expect(message.getFailureReason()).toBe(error);
    });
  });

  describe('Retry Logic', () => {
    beforeEach(() => {
      message.markFailed('Temporary error');
    });

    it('should allow retry when failed and retry count < 3', () => {
      expect(message.canRetry()).toBe(true);
    });

    it('should not allow retry when max retries exceeded', () => {
      message.incrementRetryCount();
      message.incrementRetryCount();
      message.incrementRetryCount();
      expect(message.canRetry()).toBe(false);
    });

    it('should not allow retry when message is expired', () => {
      // Create an old message (25 hours ago)
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const oldMessage = new WhatsAppMessage(
        'msg-002',
        'conv-001',
        'OUTBOUND',
        'TEXT',
        '+40723456789',
        '+40701234567',
        'Old message',
        'FAILED',
        oldDate,
        oldDate
      );
      expect(oldMessage.canRetry()).toBe(false);
    });

    it('should increment retry count', () => {
      expect(message.getRetryCount()).toBe(0);
      message.incrementRetryCount();
      expect(message.getRetryCount()).toBe(1);
    });

    it('should not allow retry when status is not FAILED', () => {
      message.markSent('wa-msg-001');
      expect(message.canRetry()).toBe(false);
    });
  });

  describe('Content Formatting', () => {
    it('should format text message content', () => {
      expect(message.getDisplayContent()).toBe('Hello customer');
    });

    it('should format template message with template name', () => {
      const templateMsg = new WhatsAppMessage(
        'msg-003',
        'conv-001',
        'OUTBOUND',
        'TEMPLATE',
        '+40723456789',
        '+40701234567',
        'Order {{1}} confirmed',
        'PENDING',
        new Date(),
        new Date(),
        'ORDER_CONFIRMED'
      );
      expect(templateMsg.getDisplayContent()).toContain('[ORDER_CONFIRMED]');
    });

    it('should format media message with caption', () => {
      const mediaMsg = new WhatsAppMessage(
        'msg-004',
        'conv-001',
        'OUTBOUND',
        'IMAGE',
        '+40723456789',
        '+40701234567',
        'Product photo',
        'PENDING',
        new Date(),
        new Date(),
        undefined,
        undefined,
        'https://example.com/image.jpg',
        'image/jpeg'
      );
      expect(mediaMsg.getDisplayContent()).toContain('[IMAGE]');
      expect(mediaMsg.getDisplayContent()).toContain('Product photo');
    });

    it('should format media message without caption', () => {
      const mediaMsg = new WhatsAppMessage(
        'msg-005',
        'conv-001',
        'OUTBOUND',
        'DOCUMENT',
        '+40723456789',
        '+40701234567',
        '',
        'PENDING',
        new Date(),
        new Date(),
        undefined,
        undefined,
        'https://example.com/doc.pdf',
        'application/pdf'
      );
      expect(mediaMsg.getDisplayContent()).toContain('[DOCUMENT]');
      expect(mediaMsg.getDisplayContent()).toContain('No caption');
    });
  });

  describe('Expiration', () => {
    it('should not be expired for recent messages', () => {
      expect(message.isExpired()).toBe(false);
    });

    it('should be expired after 24 hours', () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const oldMessage = new WhatsAppMessage(
        'msg-006',
        'conv-001',
        'OUTBOUND',
        'TEXT',
        '+40723456789',
        '+40701234567',
        'Old message',
        'PENDING',
        oldDate,
        oldDate
      );
      expect(oldMessage.isExpired()).toBe(true);
    });
  });

  describe('State Immutability', () => {
    it('should maintain immutable properties', () => {
      expect(message.id).toBe('msg-001');
      expect(message.conversationId).toBe('conv-001');
      expect(message.direction).toBe('OUTBOUND');
      expect(message.messageType).toBe('TEXT');
      expect(message.recipientPhone).toBe('+40723456789');
      expect(message.senderPhone).toBe('+40701234567');
      expect(message.content).toBe('Hello customer');
    });
  });
});
