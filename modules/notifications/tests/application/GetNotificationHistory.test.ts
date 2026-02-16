/**
 * GetNotificationHistory Use Case Tests
 * Tests history retrieval with pagination and filtering
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GetNotificationHistory } from '../../src/application/use-cases/GetNotificationHistory';

describe('GetNotificationHistory Use Case', () => {
  let useCase: GetNotificationHistory;
  let mockNotificationRepository: any;
  let mockLogger: any;

  beforeEach(() => {
    mockNotificationRepository = {
      findByRecipient: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    useCase = new GetNotificationHistory(mockNotificationRepository, mockLogger);
  });

  describe('Happy Path - History Retrieval', () => {
    it('should retrieve notification history with default pagination', async () => {
      const recipientId = 'cust-001';
      const mockNotifications = [
        createMockNotification('notif-001', 'EMAIL', 'Order Confirmed', 'SENT'),
        createMockNotification('notif-002', 'SMS', 'Order Shipped', 'SENT'),
      ];

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: mockNotifications,
        total: 2,
        hasMore: false,
        nextCursor: undefined,
      });

      const result = await useCase.execute(recipientId);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(mockNotificationRepository.findByRecipient).toHaveBeenCalledWith(
        recipientId,
        expect.objectContaining({
          page: 1,
          limit: 20,
          cursor: undefined,
        })
      );
    });

    it('should retrieve notification history with custom pagination', async () => {
      const recipientId = 'cust-001';
      const mockNotifications = Array.from({ length: 50 }, (_, i) =>
        createMockNotification(`notif-${i}`, 'EMAIL', `Notification ${i}`, 'SENT')
      );

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: mockNotifications,
        total: 100,
        hasMore: true,
        nextCursor: 'cursor-next',
      });

      const result = await useCase.execute(recipientId, 2, 50);

      expect(result.data).toHaveLength(50);
      expect(result.total).toBe(100);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('cursor-next');
      expect(mockNotificationRepository.findByRecipient).toHaveBeenCalledWith(
        recipientId,
        expect.objectContaining({
          page: 2,
          limit: 50,
        })
      );
    });

    it('should retrieve notifications with all channels', async () => {
      const mockNotifications = [
        createMockNotification('notif-001', 'EMAIL', 'Email notification', 'SENT'),
        createMockNotification('notif-002', 'SMS', 'SMS notification', 'SENT'),
        createMockNotification('notif-003', 'WHATSAPP', 'WhatsApp notification', 'SENT'),
        createMockNotification('notif-004', 'PUSH', 'Push notification', 'DELIVERED'),
        createMockNotification('notif-005', 'IN_APP', 'In-app notification', 'SENT'),
      ];

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: mockNotifications,
        total: 5,
        hasMore: false,
      });

      const result = await useCase.execute('cust-001');

      expect(result.data).toHaveLength(5);
      expect(result.data.map((d: any) => d.channel)).toEqual([
        'EMAIL',
        'SMS',
        'WHATSAPP',
        'PUSH',
        'IN_APP',
      ]);
    });

    it('should include notification details in history', async () => {
      const sentAt = new Date('2025-02-01');
      const deliveredAt = new Date('2025-02-01');

      const mockNotification = {
        id: 'notif-001',
        channel: 'EMAIL',
        subject: 'Order Confirmation',
        body: 'Your order has been confirmed',
        priority: 'NORMAL',
        createdAt: new Date('2025-02-01'),
        getStatus: () => 'DELIVERED',
        toJSON: () => ({
          sentAt,
          deliveredAt,
          failureReason: undefined,
        }),
      };

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [mockNotification],
        total: 1,
        hasMore: false,
      });

      const result = await useCase.execute('cust-001');

      expect(result.data[0]).toEqual(
        expect.objectContaining({
          id: 'notif-001',
          channel: 'EMAIL',
          subject: 'Order Confirmation',
          body: 'Your order has been confirmed',
          status: 'DELIVERED',
          priority: 'NORMAL',
          sentAt,
          deliveredAt,
        })
      );
    });
  });

  describe('Pagination', () => {
    it('should clamp page to minimum of 1', async () => {
      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [],
        total: 0,
        hasMore: false,
      });

      await useCase.execute('cust-001', 0);

      expect(mockNotificationRepository.findByRecipient).toHaveBeenCalledWith(
        'cust-001',
        expect.objectContaining({
          page: 1,
        })
      );
    });

    it('should clamp page to negative value', async () => {
      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [],
        total: 0,
        hasMore: false,
      });

      await useCase.execute('cust-001', -5);

      expect(mockNotificationRepository.findByRecipient).toHaveBeenCalledWith(
        'cust-001',
        expect.objectContaining({
          page: 1,
        })
      );
    });

    it('should clamp limit between 1 and 100', async () => {
      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [],
        total: 0,
        hasMore: false,
      });

      await useCase.execute('cust-001', 1, 0);

      expect(mockNotificationRepository.findByRecipient).toHaveBeenCalledWith(
        'cust-001',
        expect.objectContaining({
          limit: 1,
        })
      );
    });

    it('should limit max page size to 100', async () => {
      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [],
        total: 0,
        hasMore: false,
      });

      await useCase.execute('cust-001', 1, 200);

      expect(mockNotificationRepository.findByRecipient).toHaveBeenCalledWith(
        'cust-001',
        expect.objectContaining({
          limit: 100,
        })
      );
    });

    it('should use cursor-based pagination when provided', async () => {
      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [],
        total: 10,
        hasMore: true,
        nextCursor: 'cursor-2',
      });

      await useCase.execute('cust-001', 1, 20, 'cursor-1');

      expect(mockNotificationRepository.findByRecipient).toHaveBeenCalledWith(
        'cust-001',
        expect.objectContaining({
          cursor: 'cursor-1',
        })
      );
    });

    it('should return next cursor for pagination', async () => {
      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: Array.from({ length: 20 }, (_, i) =>
          createMockNotification(`notif-${i}`, 'EMAIL', `Notification ${i}`, 'SENT')
        ),
        total: 50,
        hasMore: true,
        nextCursor: 'cursor-page-2',
      });

      const result = await useCase.execute('cust-001');

      expect(result.nextCursor).toBe('cursor-page-2');
      expect(result.hasMore).toBe(true);
    });

    it('should not return next cursor when at end', async () => {
      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: Array.from({ length: 10 }, (_, i) =>
          createMockNotification(`notif-${i}`, 'EMAIL', `Notification ${i}`, 'SENT')
        ),
        total: 10,
        hasMore: false,
        nextCursor: undefined,
      });

      const result = await useCase.execute('cust-001');

      expect(result.nextCursor).toBeUndefined();
      expect(result.hasMore).toBe(false);
    });
  });

  describe('Status and Delivery Information', () => {
    it('should include sent timestamp when notification was sent', async () => {
      const sentAt = new Date('2025-02-01T10:30:00Z');
      const mockNotification = {
        id: 'notif-001',
        channel: 'EMAIL',
        subject: 'Test',
        body: 'Body',
        priority: 'NORMAL',
        createdAt: new Date(),
        getStatus: () => 'SENT',
        toJSON: () => ({
          sentAt,
          deliveredAt: undefined,
          failureReason: undefined,
        }),
      };

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [mockNotification],
        total: 1,
        hasMore: false,
      });

      const result = await useCase.execute('cust-001');

      expect(result.data[0].sentAt).toEqual(sentAt);
    });

    it('should include delivered timestamp when notification was delivered', async () => {
      const deliveredAt = new Date('2025-02-01T10:31:00Z');
      const mockNotification = {
        id: 'notif-001',
        channel: 'PUSH',
        subject: 'Alert',
        body: 'Body',
        priority: 'HIGH',
        createdAt: new Date(),
        getStatus: () => 'DELIVERED',
        toJSON: () => ({
          sentAt: new Date(),
          deliveredAt,
          failureReason: undefined,
        }),
      };

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [mockNotification],
        total: 1,
        hasMore: false,
      });

      const result = await useCase.execute('cust-001');

      expect(result.data[0].deliveredAt).toEqual(deliveredAt);
    });

    it('should include failure reason when notification failed', async () => {
      const mockNotification = {
        id: 'notif-001',
        channel: 'EMAIL',
        subject: 'Failed Email',
        body: 'Body',
        priority: 'NORMAL',
        createdAt: new Date(),
        getStatus: () => 'FAILED',
        toJSON: () => ({
          sentAt: undefined,
          deliveredAt: undefined,
          failureReason: 'Invalid email address',
        }),
      };

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [mockNotification],
        total: 1,
        hasMore: false,
      });

      const result = await useCase.execute('cust-001');

      expect(result.data[0].failureReason).toBe('Invalid email address');
    });

    it('should return all status types', async () => {
      const mockNotifications = [
        createMockNotificationWithStatus('notif-001', 'PENDING'),
        createMockNotificationWithStatus('notif-002', 'QUEUED'),
        createMockNotificationWithStatus('notif-003', 'SENDING'),
        createMockNotificationWithStatus('notif-004', 'SENT'),
        createMockNotificationWithStatus('notif-005', 'DELIVERED'),
        createMockNotificationWithStatus('notif-006', 'FAILED'),
        createMockNotificationWithStatus('notif-007', 'BOUNCED'),
      ];

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: mockNotifications,
        total: 7,
        hasMore: false,
      });

      const result = await useCase.execute('cust-001');

      expect(result.data.map((d: any) => d.status)).toEqual([
        'PENDING',
        'QUEUED',
        'SENDING',
        'SENT',
        'DELIVERED',
        'FAILED',
        'BOUNCED',
      ]);
    });
  });

  describe('Logging', () => {
    it('should log use case execution with parameters', async () => {
      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [],
        total: 0,
        hasMore: false,
      });

      await useCase.execute('cust-001', 2, 50, 'cursor-123');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'GetNotificationHistory use case started',
        expect.objectContaining({
          recipientId: 'cust-001',
          page: 2,
          limit: 50,
          hasCursor: true,
        })
      );
    });

    it('should log retrieved data count', async () => {
      const mockNotifications = Array.from({ length: 25 }, (_, i) =>
        createMockNotification(`notif-${i}`, 'EMAIL', `Notification ${i}`, 'SENT')
      );

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: mockNotifications,
        total: 100,
        hasMore: true,
      });

      await useCase.execute('cust-001', 1, 25);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'NotificationHistory retrieved',
        expect.objectContaining({
          recipientId: 'cust-001',
          returnedCount: 25,
          total: 100,
          hasMore: true,
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty history', async () => {
      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [],
        total: 0,
        hasMore: false,
      });

      const result = await useCase.execute('cust-no-notifications');

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should use default values when not specified', async () => {
      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [],
        total: 0,
        hasMore: false,
      });

      await useCase.execute('cust-001');

      expect(mockNotificationRepository.findByRecipient).toHaveBeenCalledWith(
        'cust-001',
        expect.objectContaining({
          page: 1,
          limit: 20,
          cursor: undefined,
        })
      );
    });

    it('should handle large result set', async () => {
      const mockNotifications = Array.from({ length: 100 }, (_, i) =>
        createMockNotification(`notif-${i}`, 'EMAIL', `Notification ${i}`, 'SENT')
      );

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: mockNotifications,
        total: 500,
        hasMore: true,
        nextCursor: 'cursor-5',
      });

      const result = await useCase.execute('cust-001', 1, 100);

      expect(result.data).toHaveLength(100);
      expect(result.total).toBe(500);
      expect(result.hasMore).toBe(true);
    });

    it('should handle notifications with no sent time', async () => {
      const mockNotification = {
        id: 'notif-001',
        channel: 'EMAIL',
        subject: 'Pending',
        body: 'Body',
        priority: 'NORMAL',
        createdAt: new Date(),
        getStatus: () => 'PENDING',
        toJSON: () => ({
          sentAt: undefined,
          deliveredAt: undefined,
          failureReason: undefined,
        }),
      };

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: [mockNotification],
        total: 1,
        hasMore: false,
      });

      const result = await useCase.execute('cust-001');

      expect(result.data[0].sentAt).toBeUndefined();
      expect(result.data[0].deliveredAt).toBeUndefined();
    });

    it('should maintain order from repository', async () => {
      const mockNotifications = [
        createMockNotification('notif-003', 'EMAIL', 'Third', 'SENT'),
        createMockNotification('notif-001', 'EMAIL', 'First', 'SENT'),
        createMockNotification('notif-002', 'EMAIL', 'Second', 'SENT'),
      ];

      mockNotificationRepository.findByRecipient.mockResolvedValue({
        data: mockNotifications,
        total: 3,
        hasMore: false,
      });

      const result = await useCase.execute('cust-001');

      expect(result.data.map((d: any) => d.id)).toEqual(['notif-003', 'notif-001', 'notif-002']);
    });
  });
});

// Helper functions to create mock notifications
function createMockNotification(
  id: string,
  channel: string,
  subject: string,
  status: string
): any {
  return {
    id,
    channel,
    subject,
    body: `Body for ${subject}`,
    priority: 'NORMAL',
    createdAt: new Date(),
    getStatus: () => status,
    toJSON: () => ({
      sentAt: status !== 'PENDING' && status !== 'QUEUED' ? new Date() : undefined,
      deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      failureReason: undefined,
    }),
  };
}

function createMockNotificationWithStatus(id: string, status: string): any {
  const sentAt =
    status !== 'PENDING' && status !== 'QUEUED' && status !== 'SENDING'
      ? new Date()
      : undefined;
  const deliveredAt = status === 'DELIVERED' ? new Date() : undefined;
  const failureReason = status === 'FAILED' || status === 'BOUNCED' ? 'Generic failure' : undefined;

  return {
    id,
    channel: 'EMAIL',
    subject: `Notification ${id}`,
    body: 'Body',
    priority: 'NORMAL',
    createdAt: new Date(),
    getStatus: () => status,
    toJSON: () => ({
      sentAt,
      deliveredAt,
      failureReason,
    }),
  };
}
