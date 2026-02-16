/**
 * SendNotification Use Case Tests
 * Tests sending notifications via multiple channels: Email, SMS, WhatsApp, Push, In-App
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SendNotification } from '../../src/application/use-cases/SendNotification';
import {
  TemplateNotFoundError,
  InvalidChannelError,
  QuietHoursError,
  TemplateRenderError,
  PreferenceNotFoundError,
} from '../../src/domain/errors/notification.errors';

describe('SendNotification Use Case', () => {
  let useCase: SendNotification;
  let mockNotificationRepository: any;
  let mockTemplateRepository: any;
  let mockPreferenceRepository: any;
  let mockDispatcher: any;
  let mockTemplateEngine: any;
  let mockLogger: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockNotificationRepository = {
      save: jest.fn(),
    };

    mockTemplateRepository = {
      findBySlug: jest.fn(),
    };

    mockPreferenceRepository = {
      findByCustomerAndChannel: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
    };

    mockTemplateEngine = {
      render: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
    };

    useCase = new SendNotification(
      mockNotificationRepository,
      mockTemplateRepository,
      mockPreferenceRepository,
      mockDispatcher,
      mockTemplateEngine,
      mockLogger,
      mockEventBus
    );
  });

  describe('Happy Path - Email Channel', () => {
    it('should send email notification successfully', async () => {
      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'EMAIL',
        templateSlug: 'order-confirmation',
        templateData: { orderNumber: 'ORD-001' },
        priority: 'NORMAL' as const,
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'order-confirmation',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: 'Order Confirmed',
        body: '<p>Your order ORD-001 is confirmed</p>',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue(null);

      mockNotificationRepository.save.mockResolvedValue(
        createSavedNotification('notif-123', 'cust-123', 'EMAIL')
      );

      const result = await useCase.execute(input as any);

      expect(result.notificationId).toBe('notif-123');
      expect(result.status).toBe('PENDING');
      expect(mockNotificationRepository.save).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith('notification.created', expect.any(Object));
    });

    it('should send SMS notification successfully', async () => {
      const input = {
        recipientId: 'cust-456',
        recipientPhone: '+40721234567',
        channel: 'SMS',
        templateSlug: 'order-shipped',
        templateData: { trackingNumber: 'TRK-789' },
        priority: 'HIGH' as const,
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-002',
        slug: 'order-shipped',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: '',
        body: 'Your order has shipped. Tracking: TRK-789',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue(null);

      mockNotificationRepository.save.mockResolvedValue(
        createSavedNotification('notif-456', 'cust-456', 'SMS')
      );

      const result = await useCase.execute(input as any);

      expect(result.notificationId).toBe('notif-456');
      expect(mockNotificationRepository.save).toHaveBeenCalled();
    });

    it('should send WhatsApp notification successfully', async () => {
      const input = {
        recipientId: 'cust-789',
        recipientPhone: '+40721234567',
        channel: 'WHATSAPP',
        templateSlug: 'payment-reminder',
        templateData: { dueDate: '2025-02-14' },
        priority: 'NORMAL' as const,
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-003',
        slug: 'payment-reminder',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: '',
        body: 'Reminder: Payment due on 2025-02-14',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue(null);

      mockNotificationRepository.save.mockResolvedValue(
        createSavedNotification('notif-789', 'cust-789', 'WHATSAPP')
      );

      const result = await useCase.execute(input as any);

      expect(result.notificationId).toBe('notif-789');
    });

    it('should send Push notification successfully', async () => {
      const input = {
        recipientId: 'cust-101',
        channel: 'PUSH',
        templateSlug: 'product-available',
        templateData: { productName: 'Laptop' },
        priority: 'HIGH' as const,
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-004',
        slug: 'product-available',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: 'Product Available',
        body: 'Laptop is now back in stock',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue(null);

      mockNotificationRepository.save.mockResolvedValue(
        createSavedNotification('notif-101', 'cust-101', 'PUSH')
      );

      const result = await useCase.execute(input as any);

      expect(result.notificationId).toBe('notif-101');
    });

    it('should send In-App notification successfully', async () => {
      const input = {
        recipientId: 'cust-202',
        channel: 'IN_APP',
        templateSlug: 'account-update',
        templateData: { changeType: 'email' },
        priority: 'NORMAL' as const,
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-005',
        slug: 'account-update',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: 'Account Updated',
        body: 'Your account email has been updated',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue(null);

      mockNotificationRepository.save.mockResolvedValue(
        createSavedNotification('notif-202', 'cust-202', 'IN_APP')
      );

      const result = await useCase.execute(input as any);

      expect(result.notificationId).toBe('notif-202');
    });
  });

  describe('Error Cases', () => {
    it('should throw InvalidChannelError for invalid channel', async () => {
      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'INVALID_CHANNEL',
        templateSlug: 'order-confirmation',
        templateData: {},
      };

      await expect(useCase.execute(input as any)).rejects.toThrow(InvalidChannelError);
    });

    it('should throw TemplateNotFoundError when template does not exist', async () => {
      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'EMAIL',
        templateSlug: 'nonexistent-template',
        templateData: {},
      };

      mockTemplateRepository.findBySlug.mockResolvedValue(null);

      await expect(useCase.execute(input as any)).rejects.toThrow(TemplateNotFoundError);
    });

    it('should throw TemplateRenderError when template rendering fails', async () => {
      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'EMAIL',
        templateSlug: 'order-confirmation',
        templateData: {},
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'order-confirmation',
      });

      mockTemplateEngine.render.mockImplementation(() => {
        throw new Error('Missing required variable: orderNumber');
      });

      await expect(useCase.execute(input as any)).rejects.toThrow(TemplateRenderError);
    });

    it('should throw PreferenceNotFoundError when customer has disabled channel', async () => {
      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'EMAIL',
        templateSlug: 'order-confirmation',
        templateData: {},
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'order-confirmation',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: 'Order Confirmed',
        body: 'Content',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue({
        getIsEnabled: () => false,
      });

      await expect(useCase.execute(input as any)).rejects.toThrow(PreferenceNotFoundError);
    });

    it('should throw QuietHoursError when within quiet hours', async () => {
      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'EMAIL',
        templateSlug: 'order-confirmation',
        templateData: {},
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'order-confirmation',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: 'Order Confirmed',
        body: 'Content',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue({
        getIsEnabled: () => true,
        isAllowed: () => false, // Not allowed due to quiet hours
      });

      await expect(useCase.execute(input as any)).rejects.toThrow(QuietHoursError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle notification with scheduled time', async () => {
      const scheduledTime = new Date(Date.now() + 3600000); // 1 hour from now

      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'EMAIL',
        templateSlug: 'order-confirmation',
        templateData: {},
        scheduledAt: scheduledTime,
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'order-confirmation',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: 'Order Confirmed',
        body: 'Content',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue(null);

      mockNotificationRepository.save.mockResolvedValue(
        createSavedNotification('notif-123', 'cust-123', 'EMAIL')
      );

      const result = await useCase.execute(input as any);

      expect(result.notificationId).toBe('notif-123');
      const savedCall = mockNotificationRepository.save.mock.calls[0][0];
      expect(savedCall.scheduledAt).toEqual(scheduledTime);
    });

    it('should handle empty template data', async () => {
      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'EMAIL',
        templateSlug: 'simple-notification',
        templateData: {},
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'simple-notification',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: 'Hello',
        body: 'Simple message',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue(null);

      mockNotificationRepository.save.mockResolvedValue(
        createSavedNotification('notif-123', 'cust-123', 'EMAIL')
      );

      const result = await useCase.execute(input as any);

      expect(result.notificationId).toBe('notif-123');
    });

    it('should set NORMAL priority as default', async () => {
      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'EMAIL',
        templateSlug: 'order-confirmation',
        templateData: {},
        // No priority specified
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'order-confirmation',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: 'Order Confirmed',
        body: 'Content',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue(null);

      mockNotificationRepository.save.mockResolvedValue(
        createSavedNotification('notif-123', 'cust-123', 'EMAIL')
      );

      await useCase.execute(input as any);

      const savedCall = mockNotificationRepository.save.mock.calls[0][0];
      expect(savedCall.priority).toBe('NORMAL');
    });

    it('should respect custom priority when specified', async () => {
      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'EMAIL',
        templateSlug: 'urgent-alert',
        templateData: {},
        priority: 'URGENT' as const,
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'urgent-alert',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: 'Urgent',
        body: 'Urgent message',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue(null);

      mockNotificationRepository.save.mockResolvedValue(
        createSavedNotification('notif-123', 'cust-123', 'EMAIL')
      );

      await useCase.execute(input as any);

      const savedCall = mockNotificationRepository.save.mock.calls[0][0];
      expect(savedCall.priority).toBe('URGENT');
    });

    it('should work when preference allows channel', async () => {
      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'EMAIL',
        templateSlug: 'order-confirmation',
        templateData: {},
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'order-confirmation',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: 'Order Confirmed',
        body: 'Content',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue({
        getIsEnabled: () => true,
        isAllowed: () => true, // Channel is allowed
      });

      mockNotificationRepository.save.mockResolvedValue(
        createSavedNotification('notif-123', 'cust-123', 'EMAIL')
      );

      const result = await useCase.execute(input as any);

      expect(result.notificationId).toBe('notif-123');
      expect(mockEventBus.publish).toHaveBeenCalled();
    });
  });

  describe('Event Publishing', () => {
    it('should publish notification.created event with correct payload', async () => {
      const input = {
        recipientId: 'cust-123',
        recipientEmail: 'customer@example.com',
        channel: 'EMAIL',
        templateSlug: 'order-confirmation',
        templateData: { orderNumber: 'ORD-001' },
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'order-confirmation',
      });

      mockTemplateEngine.render.mockReturnValue({
        subject: 'Order Confirmed',
        body: 'Content',
      });

      mockPreferenceRepository.findByCustomerAndChannel.mockResolvedValue(null);

      mockNotificationRepository.save.mockResolvedValue(
        createSavedNotification('notif-123', 'cust-123', 'EMAIL')
      );

      await useCase.execute(input as any);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'notification.created',
        expect.objectContaining({
          notificationId: 'notif-123',
          recipientId: 'cust-123',
          channel: 'EMAIL',
          templateSlug: 'order-confirmation',
        })
      );
    });
  });
});

function createSavedNotification(id: string, recipientId: string, channel: string): any {
  return {
    id,
    recipientId,
    channel,
    priority: 'NORMAL',
    getStatus: () => 'PENDING',
  };
}
