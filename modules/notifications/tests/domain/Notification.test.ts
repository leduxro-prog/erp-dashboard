/**
 * Notification Entity Tests
 * Tests for domain entity business logic
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { Notification } from '../../src/domain/entities/Notification';

describe('Notification Entity', () => {
  let notification: Notification;

  beforeEach(() => {
    notification = new Notification({
      id: 'test-id',
      type: 'EMAIL',
      channel: 'EMAIL',
      recipientId: 'customer-1',
      recipientEmail: 'test@example.com',
      subject: 'Test Email',
      body: 'Test Body',
      status: 'PENDING',
      priority: 'NORMAL',
      retryCount: 0,
    });
  });

  describe('Status Transitions', () => {
    it('should queue a pending notification', () => {
      notification.queue();
      expect(notification.getStatus()).toBe('QUEUED');
    });

    it('should mark notification as sending', () => {
      notification.queue();
      notification.markAsSending();
      expect(notification.getStatus()).toBe('SENDING');
    });

    it('should mark notification as sent', () => {
      notification.queue();
      notification.markAsSending();
      notification.markAsSent();
      expect(notification.getStatus()).toBe('SENT');
      expect(notification.toJSON().sentAt).toBeDefined();
    });

    it('should mark notification as delivered', () => {
      notification.queue();
      notification.markAsSending();
      notification.markAsSent();
      notification.markAsDelivered();
      expect(notification.getStatus()).toBe('DELIVERED');
      expect(notification.toJSON().deliveredAt).toBeDefined();
    });

    it('should throw on invalid status transition', () => {
      notification.queue();
      expect(() => notification.queue()).toThrow();
    });
  });

  describe('Failure Handling', () => {
    it('should mark notification as failed with reason', () => {
      notification.queue();
      notification.markAsSending();
      notification.markAsFailed('SMTP Connection Timeout');
      expect(notification.getStatus()).toBe('FAILED');
      expect(notification.toJSON().failureReason).toBe('SMTP Connection Timeout');
    });

    it('should mark notification as bounced', () => {
      notification.queue();
      notification.markAsSending();
      notification.markAsBounced();
      expect(notification.getStatus()).toBe('BOUNCED');
      expect(notification.toJSON().failureReason).toContain('Bounced');
    });
  });

  describe('Retry Logic', () => {
    it('should allow retry when failed and retryCount < 3', () => {
      notification.queue();
      notification.markAsSending();
      notification.markAsFailed('Connection error');
      expect(notification.canRetry()).toBe(true);
    });

    it('should schedule retry with exponential backoff', () => {
      notification.queue();
      notification.markAsSending();
      notification.markAsFailed('Error 1');
      notification.scheduleRetry();

      expect(notification.getStatus()).toBe('PENDING');
      expect(notification.getRetryCount()).toBe(1);
      expect(notification.toJSON().scheduledAt).toBeDefined();
      expect(notification.toJSON().scheduledAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should not allow retry after max retries', () => {
      const props = notification.toJSON();
      notification = new Notification({
        ...props,
        retryCount: 3,
        status: 'FAILED',
      });

      expect(notification.canRetry()).toBe(false);
    });

    it('should throw on retry when max retries exceeded', () => {
      notification.queue();
      notification.markAsSending();
      notification.markAsFailed('Error');
      notification.scheduleRetry();
      notification.queue();
      notification.markAsSending();
      notification.markAsFailed('Error');
      notification.scheduleRetry();
      notification.queue();
      notification.markAsSending();
      notification.markAsFailed('Error');
      notification.scheduleRetry();
      notification.queue();
      notification.markAsSending();
      notification.markAsFailed('Error');

      expect(() => notification.scheduleRetry()).toThrow();
    });
  });

  describe('Expiration', () => {
    it('should not be expired for recent notifications', () => {
      expect(notification.isExpired()).toBe(false);
    });

    it('should be expired after 24+ hours', () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      notification = new Notification({
        ...notification.toJSON(),
        createdAt: oldDate,
      });

      expect(notification.isExpired()).toBe(true);
    });
  });

  describe('Ready to Send', () => {
    it('should be ready to send immediately if no scheduledAt', () => {
      expect(notification.isReadyToSend()).toBe(true);
    });

    it('should not be ready if scheduled for future', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000);
      notification = new Notification({
        ...notification.toJSON(),
        scheduledAt: futureDate,
      });

      expect(notification.isReadyToSend()).toBe(false);
    });

    it('should be ready if scheduled time has passed', () => {
      const pastDate = new Date(Date.now() - 60 * 1000);
      notification = new Notification({
        ...notification.toJSON(),
        scheduledAt: pastDate,
      });

      expect(notification.isReadyToSend()).toBe(true);
    });

    it('should not be ready if not in PENDING or QUEUED status', () => {
      notification.queue();
      notification.markAsSending();

      expect(notification.isReadyToSend()).toBe(false);
    });
  });

  describe('Cancellation', () => {
    it('should cancel pending notification', () => {
      notification.cancel();
      expect(notification.getStatus()).toBe('FAILED');
      expect(notification.toJSON().failureReason).toBe('Cancelled by user');
    });

    it('should cancel queued notification', () => {
      notification.queue();
      notification.cancel();
      expect(notification.getStatus()).toBe('FAILED');
    });

    it('should not allow cancel on already sent notification', () => {
      notification.queue();
      notification.markAsSending();
      notification.markAsSent();

      expect(() => notification.cancel()).toThrow();
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize to JSON with all properties', () => {
      const json = notification.toJSON();

      expect(json.id).toBe('test-id');
      expect(json.type).toBe('EMAIL');
      expect(json.channel).toBe('EMAIL');
      expect(json.recipientId).toBe('customer-1');
      expect(json.subject).toBe('Test Email');
      expect(json.status).toBe('PENDING');
      expect(json.priority).toBe('NORMAL');
    });
  });
});
