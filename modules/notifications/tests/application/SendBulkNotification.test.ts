/**
 * SendBulkNotification Use Case Tests
 * Tests bulk sending of notifications with batching and error handling
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SendBulkNotification } from '../../src/application/use-cases/SendBulkNotification';
import { InvalidChannelError, TemplateNotFoundError } from '../../src/domain/errors/notification.errors';

describe('SendBulkNotification Use Case', () => {
  let useCase: SendBulkNotification;
  let mockNotificationRepository: any;
  let mockTemplateRepository: any;
  let mockLogger: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockNotificationRepository = {
      save: jest.fn(),
    };

    mockTemplateRepository = {
      findBySlug: jest.fn(),
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

    useCase = new SendBulkNotification(
      mockNotificationRepository,
      mockTemplateRepository,
      mockLogger,
      mockEventBus
    );
  });

  describe('Happy Path - Bulk Sending', () => {
    it('should send bulk notifications to multiple recipients', async () => {
      const input = {
        recipientIds: ['cust-001', 'cust-002', 'cust-003'],
        channel: 'EMAIL',
        templateSlug: 'welcome-email',
        templateData: { companyName: 'ACME' },
        batchName: 'Q1 Welcome Campaign',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'welcome-email',
        render: () => ({ subject: 'Welcome', body: 'Welcome to ACME' }),
      });

      let callCount = 0;
      mockNotificationRepository.save.mockImplementation(async () => {
        return {
          id: `notif-${++callCount}`,
          recipientId: `cust-00${callCount}`,
          channel: 'EMAIL',
        };
      });

      const result = await useCase.execute(input as any);

      expect(result.batchId).toBeDefined();
      expect(result.totalCount).toBe(3);
      expect(mockNotificationRepository.save).toHaveBeenCalledTimes(3);
      expect(mockEventBus.publish).toHaveBeenCalledWith('notification.batch_created', expect.any(Object));
    });

    it('should send bulk SMS notifications', async () => {
      const input = {
        recipientIds: ['phone-1', 'phone-2', 'phone-3', 'phone-4'],
        channel: 'SMS',
        templateSlug: 'order-shipped',
        templateData: { trackingNumber: 'TRK-001' },
        batchName: 'Order Shipped Batch',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-002',
        slug: 'order-shipped',
        render: () => ({ subject: '', body: 'Your order shipped' }),
      });

      let callCount = 0;
      mockNotificationRepository.save.mockImplementation(async () => ({
        id: `notif-${++callCount}`,
        recipientId: `phone-${callCount}`,
        channel: 'SMS',
      }));

      const result = await useCase.execute(input as any);

      expect(result.totalCount).toBe(4);
      expect(mockNotificationRepository.save).toHaveBeenCalledTimes(4);
    });

    it('should send bulk notifications with high priority', async () => {
      const input = {
        recipientIds: ['cust-a', 'cust-b', 'cust-c'],
        channel: 'WHATSAPP',
        templateSlug: 'urgent-alert',
        templateData: { alertType: 'security' },
        priority: 'URGENT' as const,
        batchName: 'Security Alert Batch',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-003',
        slug: 'urgent-alert',
        render: () => ({ subject: 'Alert', body: 'Security alert' }),
      });

      let callCount = 0;
      mockNotificationRepository.save.mockImplementation(async () => ({
        id: `notif-${++callCount}`,
        recipientId: `cust-${String.fromCharCode(97 + callCount - 1)}`,
        channel: 'WHATSAPP',
      }));

      const result = await useCase.execute(input as any);

      expect(result.totalCount).toBe(3);
      expect(mockNotificationRepository.save).toHaveBeenCalledTimes(3);
    });

    it('should handle large batch of recipients', async () => {
      const recipientIds = Array.from({ length: 100 }, (_, i) => `cust-${i + 1}`);

      const input = {
        recipientIds,
        channel: 'PUSH',
        templateSlug: 'product-launch',
        templateData: { productName: 'Widget' },
        batchName: 'Product Launch Push',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-004',
        slug: 'product-launch',
        render: () => ({ subject: 'New Product', body: 'Widget available' }),
      });

      let callCount = 0;
      mockNotificationRepository.save.mockImplementation(async () => ({
        id: `notif-${++callCount}`,
        recipientId: `cust-${callCount}`,
        channel: 'PUSH',
      }));

      const result = await useCase.execute(input as any);

      expect(result.totalCount).toBe(100);
      expect(mockNotificationRepository.save).toHaveBeenCalledTimes(100);
    });
  });

  describe('Error Cases', () => {
    it('should throw InvalidChannelError for invalid channel', async () => {
      const input = {
        recipientIds: ['cust-001'],
        channel: 'INVALID_CHANNEL',
        templateSlug: 'welcome-email',
        templateData: {},
        batchName: 'Test Batch',
      };

      await expect(useCase.execute(input as any)).rejects.toThrow(InvalidChannelError);
    });

    it('should throw TemplateNotFoundError when template does not exist', async () => {
      const input = {
        recipientIds: ['cust-001'],
        channel: 'EMAIL',
        templateSlug: 'nonexistent-template',
        templateData: {},
        batchName: 'Test Batch',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue(null);

      await expect(useCase.execute(input as any)).rejects.toThrow(TemplateNotFoundError);
    });

    it('should skip recipients with template rendering errors and continue', async () => {
      const input = {
        recipientIds: ['cust-001', 'cust-002', 'cust-003'],
        channel: 'EMAIL',
        templateSlug: 'template-with-vars',
        templateData: { orderNumber: 'ORD-001' },
        batchName: 'Partial Failure Batch',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'template-with-vars',
        render: jest.fn()
          .mockImplementationOnce(() => ({ subject: 'Subject', body: 'Body' }))
          .mockImplementationOnce(() => { throw new Error('Missing variable'); })
          .mockImplementationOnce(() => ({ subject: 'Subject', body: 'Body' })),
      });

      let callCount = 0;
      mockNotificationRepository.save.mockImplementation(async () => ({
        id: `notif-${++callCount}`,
        recipientId: `cust-00${callCount}`,
        channel: 'EMAIL',
      }));

      const result = await useCase.execute(input as any);

      // Should create notifications for successful renders only
      expect(result.totalCount).toBe(2); // cust-001 and cust-003
      expect(mockNotificationRepository.save).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to render template for recipient',
        expect.any(Object)
      );
    });

    it('should log errors that occur during notification creation', async () => {
      const input = {
        recipientIds: ['cust-001', 'cust-002'],
        channel: 'EMAIL',
        templateSlug: 'test-template',
        templateData: {},
        batchName: 'Error Test Batch',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'test-template',
        render: () => ({ subject: 'Subject', body: 'Body' }),
      });

      mockNotificationRepository.save
        .mockResolvedValueOnce({ id: 'notif-001' })
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await useCase.execute(input as any);

      // Should have one successful and log the error
      expect(result.totalCount).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating notification for recipient',
        expect.any(Object)
      );
    });
  });

  describe('Edge Cases', () => {
    it('should reject empty recipient list', async () => {
      const input = {
        recipientIds: [],
        channel: 'EMAIL',
        templateSlug: 'template',
        templateData: {},
        batchName: 'Empty Batch',
      };

      await expect(useCase.execute(input as any)).rejects.toThrow('At least one recipient is required');
      expect(mockNotificationRepository.save).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should handle single recipient bulk send', async () => {
      const input = {
        recipientIds: ['cust-001'],
        channel: 'EMAIL',
        templateSlug: 'welcome-email',
        templateData: {},
        batchName: 'Single Recipient Batch',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'welcome-email',
        render: () => ({ subject: 'Welcome', body: 'Welcome' }),
      });

      mockNotificationRepository.save.mockResolvedValue({
        id: 'notif-001',
        recipientId: 'cust-001',
        channel: 'EMAIL',
      });

      const result = await useCase.execute(input as any);

      expect(result.totalCount).toBe(1);
      expect(mockNotificationRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should set NORMAL priority as default', async () => {
      const input = {
        recipientIds: ['cust-001'],
        channel: 'EMAIL',
        templateSlug: 'template',
        templateData: {},
        batchName: 'Default Priority Batch',
        // No priority specified
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'template',
        render: () => ({ subject: 'Subject', body: 'Body' }),
      });

      mockNotificationRepository.save.mockImplementation(async (notification: any) => ({
        id: 'notif-001',
        ...notification,
      }));

      await useCase.execute(input as any);

      const savedNotification = mockNotificationRepository.save.mock.calls[0][0];
      expect(savedNotification.priority).toBe('NORMAL');
    });

    it('should include batchId in metadata for all notifications', async () => {
      const input = {
        recipientIds: ['cust-001', 'cust-002'],
        channel: 'EMAIL',
        templateSlug: 'template',
        templateData: {},
        batchName: 'Metadata Test',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'template',
        render: () => ({ subject: 'Subject', body: 'Body' }),
      });

      const savedNotifications: any[] = [];
      mockNotificationRepository.save.mockImplementation(async (notification: any) => {
        savedNotifications.push(notification);
        return { id: `notif-${savedNotifications.length}` };
      });

      const result = await useCase.execute(input as any);

      // All notifications should have batchId in metadata
      savedNotifications.forEach((notif) => {
        expect(notif.metadata).toHaveProperty('batchId');
        expect(notif.metadata.batchId).toBe(result.batchId);
      });
    });

    it('should handle template data with complex objects', async () => {
      const complexData = {
        order: {
          id: 'ORD-001',
          items: [
            { name: 'Item 1', quantity: 2, price: 100 },
            { name: 'Item 2', quantity: 1, price: 200 },
          ],
        },
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      const input = {
        recipientIds: ['cust-001'],
        channel: 'EMAIL',
        templateSlug: 'order-details',
        templateData: complexData,
        batchName: 'Complex Data Batch',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'order-details',
        render: () => ({ subject: 'Order Details', body: 'Order content' }),
      });

      mockNotificationRepository.save.mockResolvedValue({
        id: 'notif-001',
        recipientId: 'cust-001',
        channel: 'EMAIL',
      });

      const result = await useCase.execute(input as any);

      expect(result.totalCount).toBe(1);
      const savedNotif = mockNotificationRepository.save.mock.calls[0][0];
      expect(savedNotif.templateData).toEqual(complexData);
    });
  });

  describe('Event Publishing', () => {
    it('should publish notification.batch_created event with correct payload', async () => {
      const input = {
        recipientIds: ['cust-001', 'cust-002'],
        channel: 'EMAIL',
        templateSlug: 'welcome-email',
        templateData: {},
        batchName: 'Welcome Campaign',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'welcome-email',
        render: () => ({ subject: 'Welcome', body: 'Welcome' }),
      });

      let callCount = 0;
      mockNotificationRepository.save.mockImplementation(async () => ({
        id: `notif-${++callCount}`,
        recipientId: `cust-00${callCount}`,
        channel: 'EMAIL',
      }));

      const result = await useCase.execute(input as any);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'notification.batch_created',
        expect.objectContaining({
          batchId: result.batchId,
          batchName: 'Welcome Campaign',
          notificationCount: 2,
          channel: 'EMAIL',
          templateSlug: 'welcome-email',
        })
      );
    });

    it('should log batch creation details', async () => {
      const input = {
        recipientIds: ['cust-001', 'cust-002', 'cust-003'],
        channel: 'EMAIL',
        templateSlug: 'template',
        templateData: {},
        batchName: 'Test Batch',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'template',
        render: () => ({ subject: 'Subject', body: 'Body' }),
      });

      let callCount = 0;
      mockNotificationRepository.save.mockImplementation(async () => ({
        id: `notif-${++callCount}`,
        recipientId: `cust-00${callCount}`,
        channel: 'EMAIL',
      }));

      await useCase.execute(input as any);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Bulk notification batch created',
        expect.objectContaining({
          batchName: 'Test Batch',
          totalNotifications: 3,
          expectedRecipients: 3,
        })
      );
    });
  });

  describe('Batch Processing', () => {
    it('should process recipients sequentially', async () => {
      const input = {
        recipientIds: ['cust-001', 'cust-002', 'cust-003'],
        channel: 'EMAIL',
        templateSlug: 'template',
        templateData: {},
        batchName: 'Sequential Processing',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue({
        id: 'tpl-001',
        slug: 'template',
        render: () => ({ subject: 'Subject', body: 'Body' }),
      });

      const processedRecipients: string[] = [];
      mockNotificationRepository.save.mockImplementation(async (notification: any) => {
        processedRecipients.push(notification.recipientId);
        return { id: `notif-${processedRecipients.length}` };
      });

      await useCase.execute(input as any);

      // Recipients should be processed in order
      expect(processedRecipients).toEqual(['cust-001', 'cust-002', 'cust-003']);
    });

    it('should validate all channels before creating notifications', async () => {
      const input = {
        recipientIds: ['cust-001', 'cust-002'],
        channel: 'INVALID',
        templateSlug: 'template',
        templateData: {},
        batchName: 'Channel Validation',
      };

      await expect(useCase.execute(input as any)).rejects.toThrow(InvalidChannelError);
      expect(mockNotificationRepository.save).not.toHaveBeenCalled();
    });

    it('should validate template existence before creating notifications', async () => {
      const input = {
        recipientIds: ['cust-001', 'cust-002'],
        channel: 'EMAIL',
        templateSlug: 'nonexistent',
        templateData: {},
        batchName: 'Template Validation',
      };

      mockTemplateRepository.findBySlug.mockResolvedValue(null);

      await expect(useCase.execute(input as any)).rejects.toThrow(TemplateNotFoundError);
      expect(mockNotificationRepository.save).not.toHaveBeenCalled();
    });
  });
});
