/**
 * ProcessNotificationQueue Use Case Tests
 * Tests queue processing with retries and batch handling
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProcessNotificationQueue } from '../../src/application/use-cases/ProcessNotificationQueue';

describe('ProcessNotificationQueue Use Case', () => {
  let useCase: ProcessNotificationQueue;
  let mockNotificationRepository: any;
  let mockDispatcher: any;
  let mockLogger: any;
  let mockEventBus: any;

  beforeEach(() => {
    mockNotificationRepository = {
      findPending: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
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

    useCase = new ProcessNotificationQueue(
      mockNotificationRepository,
      mockDispatcher,
      mockLogger,
      mockEventBus
    );
  });

  describe('Happy Path - Queue Processing', () => {
    it('should process pending notifications successfully', async () => {
      const notifications = [
        createMockNotification('notif-001', 'EMAIL', 'cust-001'),
        createMockNotification('notif-002', 'SMS', 'cust-002'),
      ];

      mockNotificationRepository.findPending.mockResolvedValue(notifications);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      const result = await useCase.execute();

      expect(result.processed).toBe(2);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(2);
      expect(mockNotificationRepository.update).toHaveBeenCalledTimes(4); // queue + sent twice
    });

    it('should use default batch size of 100', async () => {
      mockNotificationRepository.findPending.mockResolvedValue([]);

      await useCase.execute();

      expect(mockNotificationRepository.findPending).toHaveBeenCalledWith(100);
    });

    it('should allow custom batch size', async () => {
      mockNotificationRepository.findPending.mockResolvedValue([]);

      await useCase.execute(50);

      expect(mockNotificationRepository.findPending).toHaveBeenCalledWith(50);
    });

    it('should handle mixed channel types in batch', async () => {
      const notifications = [
        createMockNotification('notif-001', 'EMAIL', 'cust-001'),
        createMockNotification('notif-002', 'SMS', 'cust-002'),
        createMockNotification('notif-003', 'WHATSAPP', 'cust-003'),
        createMockNotification('notif-004', 'PUSH', 'cust-004'),
      ];

      mockNotificationRepository.findPending.mockResolvedValue(notifications);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      const result = await useCase.execute();

      expect(result.sent).toBe(4);
      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(4);
    });

    it('should return statistics with correct duration', async () => {
      mockNotificationRepository.findPending.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result).toHaveProperty('duration');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should process notifications with different priorities', async () => {
      const notifications = [
        createMockNotification('notif-001', 'EMAIL', 'cust-001', 'URGENT'),
        createMockNotification('notif-002', 'EMAIL', 'cust-002', 'NORMAL'),
        createMockNotification('notif-003', 'EMAIL', 'cust-003', 'LOW'),
      ];

      mockNotificationRepository.findPending.mockResolvedValue(notifications);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      const result = await useCase.execute();

      expect(result.sent).toBe(3);
    });
  });

  describe('Error Cases - Dispatch Failures', () => {
    it('should mark notification as failed on dispatch error', async () => {
      const notification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      mockNotificationRepository.findPending.mockResolvedValue([notification]);
      mockDispatcher.dispatch.mockRejectedValue(new Error('SMTP Connection failed'));

      const result = await useCase.execute();

      expect(result.failed).toBe(1);
      expect(result.sent).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Notification dispatch failed',
        expect.any(Object)
      );
    });

    it('should log retry capability on failure', async () => {
      const notification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      notification.canRetry = jest.fn().mockReturnValue(true);

      mockNotificationRepository.findPending.mockResolvedValue([notification]);
      mockDispatcher.dispatch.mockRejectedValue(new Error('Provider timeout'));

      const result = await useCase.execute();

      expect(result.failed).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Notification dispatch failed',
        expect.objectContaining({
          canRetry: true,
        })
      );
    });

    it('should publish notification.failed event on dispatch error', async () => {
      const notification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      mockNotificationRepository.findPending.mockResolvedValue([notification]);
      mockDispatcher.dispatch.mockRejectedValue(new Error('Network error'));

      await useCase.execute();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'notification.failed',
        expect.objectContaining({
          notificationId: 'notif-001',
          recipientId: 'cust-001',
          channel: 'EMAIL',
          reason: 'Network error',
        })
      );
    });

    it('should handle partial batch failures', async () => {
      const notifications = [
        createMockNotification('notif-001', 'EMAIL', 'cust-001'),
        createMockNotification('notif-002', 'EMAIL', 'cust-002'),
        createMockNotification('notif-003', 'EMAIL', 'cust-003'),
      ];

      mockNotificationRepository.findPending.mockResolvedValue(notifications);
      mockDispatcher.dispatch
        .mockResolvedValueOnce({ messageId: 'msg-001' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ messageId: 'msg-003' });

      const result = await useCase.execute();

      expect(result.processed).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('Expiration Handling', () => {
    it('should skip and mark expired notifications as failed', async () => {
      const expiredNotification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      expiredNotification.isExpired = jest.fn().mockReturnValue(true);
      expiredNotification.isReadyToSend = jest.fn().mockReturnValue(true);

      mockNotificationRepository.findPending.mockResolvedValue([expiredNotification]);

      const result = await useCase.execute();

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.sent).toBe(0);
      expect(mockNotificationRepository.updateStatus).toHaveBeenCalledWith('notif-001', 'FAILED');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Notification expired, skipping',
        expect.any(Object)
      );
    });

    it('should publish notification.expired event', async () => {
      const expiredNotification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      expiredNotification.isExpired = jest.fn().mockReturnValue(true);

      mockNotificationRepository.findPending.mockResolvedValue([expiredNotification]);

      await useCase.execute();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'notification.expired',
        expect.objectContaining({
          notificationId: 'notif-001',
        })
      );
    });

    it('should not process non-expired notifications', async () => {
      const freshNotification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      freshNotification.isExpired = jest.fn().mockReturnValue(false);

      mockNotificationRepository.findPending.mockResolvedValue([freshNotification]);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      const result = await useCase.execute();

      expect(result.sent).toBe(1);
      expect(mockDispatcher.dispatch).toHaveBeenCalled();
    });
  });

  describe('Scheduled Notifications', () => {
    it('should skip notifications not ready to send', async () => {
      const scheduledNotification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      scheduledNotification.isReadyToSend = jest.fn().mockReturnValue(false);
      scheduledNotification.isExpired = jest.fn().mockReturnValue(false);

      mockNotificationRepository.findPending.mockResolvedValue([scheduledNotification]);

      const result = await useCase.execute();

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0); // Not counted as failed, just skipped
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should process notifications that are ready to send', async () => {
      const readyNotification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      readyNotification.isReadyToSend = jest.fn().mockReturnValue(true);
      readyNotification.isExpired = jest.fn().mockReturnValue(false);

      mockNotificationRepository.findPending.mockResolvedValue([readyNotification]);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      const result = await useCase.execute();

      expect(result.sent).toBe(1);
    });

    it('should handle mixed ready and not-ready notifications', async () => {
      const readyNotif = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      readyNotif.isReadyToSend = jest.fn().mockReturnValue(true);
      readyNotif.isExpired = jest.fn().mockReturnValue(false);

      const notReadyNotif = createMockNotification('notif-002', 'EMAIL', 'cust-002');
      notReadyNotif.isReadyToSend = jest.fn().mockReturnValue(false);
      notReadyNotif.isExpired = jest.fn().mockReturnValue(false);

      mockNotificationRepository.findPending.mockResolvedValue([readyNotif, notReadyNotif]);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      const result = await useCase.execute();

      expect(result.processed).toBe(2);
      expect(result.sent).toBe(1); // Only ready one
    });
  });

  describe('Status Updates', () => {
    it('should update notification status to SENDING before dispatch', async () => {
      const notification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      mockNotificationRepository.findPending.mockResolvedValue([notification]);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      await useCase.execute();

      const markAsSendingCall = notification.markAsSending.mock.calls[0];
      expect(markAsSendingCall).toBeDefined();
    });

    it('should update notification status to SENT on successful dispatch', async () => {
      const notification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      mockNotificationRepository.findPending.mockResolvedValue([notification]);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      await useCase.execute();

      const markAsSentCall = notification.markAsSent.mock.calls[0];
      expect(markAsSentCall).toBeDefined();
      expect(mockNotificationRepository.update).toHaveBeenCalledWith(notification);
    });

    it('should update notification status to FAILED on dispatch error', async () => {
      const notification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      mockNotificationRepository.findPending.mockResolvedValue([notification]);
      mockDispatcher.dispatch.mockRejectedValue(new Error('Provider error'));

      await useCase.execute();

      expect(notification.markAsFailed).toHaveBeenCalled();
      expect(mockNotificationRepository.update).toHaveBeenCalledWith(notification);
    });
  });

  describe('Event Publishing', () => {
    it('should publish notification.sent event on success', async () => {
      const notification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      mockNotificationRepository.findPending.mockResolvedValue([notification]);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-abc-123' });

      await useCase.execute();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'notification.sent',
        expect.objectContaining({
          notificationId: 'notif-001',
          recipientId: 'cust-001',
          channel: 'EMAIL',
          messageId: 'msg-abc-123',
        })
      );
    });

    it('should include sentAt timestamp in sent event', async () => {
      const notification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      mockNotificationRepository.findPending.mockResolvedValue([notification]);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      await useCase.execute();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'notification.sent',
        expect.objectContaining({
          sentAt: expect.any(Date),
        })
      );
    });

    it('should include failedAt timestamp in failed event', async () => {
      const notification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      mockNotificationRepository.findPending.mockResolvedValue([notification]);
      mockDispatcher.dispatch.mockRejectedValue(new Error('Network timeout'));

      await useCase.execute();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'notification.failed',
        expect.objectContaining({
          failedAt: expect.any(Date),
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queue', async () => {
      mockNotificationRepository.findPending.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result.processed).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('No pending notifications to process');
    });

    it('should handle large batch processing', async () => {
      const notifications = Array.from({ length: 100 }, (_, i) =>
        createMockNotification(`notif-${i}`, 'EMAIL', `cust-${i}`)
      );

      mockNotificationRepository.findPending.mockResolvedValue(notifications);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      const result = await useCase.execute(100);

      expect(result.processed).toBe(100);
      expect(result.sent).toBe(100);
      expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(100);
    });

    it('should recover from unexpected errors during processing', async () => {
      const notification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      notification.isReadyToSend = jest.fn().mockReturnValue(false);
      notification.toJSON = jest.fn().mockImplementation(() => {
        throw new Error('Serialization error');
      });

      mockNotificationRepository.findPending.mockResolvedValue([notification]);

      const result = await useCase.execute();

      expect(result.failed).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error processing notification',
        expect.any(Object)
      );
    });

    it('should log batch processing start and completion', async () => {
      const notification = createMockNotification('notif-001', 'EMAIL', 'cust-001');
      mockNotificationRepository.findPending.mockResolvedValue([notification]);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      await useCase.execute(50);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ProcessNotificationQueue started',
        expect.objectContaining({
          batchSize: 50,
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'ProcessNotificationQueue completed',
        expect.any(Object)
      );
    });

    it('should include channel info in dispatch logs', async () => {
      const notification = createMockNotification('notif-001', 'WHATSAPP', 'cust-001');
      mockNotificationRepository.findPending.mockResolvedValue([notification]);
      mockDispatcher.dispatch.mockResolvedValue({ messageId: 'msg-123' });

      await useCase.execute();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Notification sent successfully',
        expect.objectContaining({
          channel: 'WHATSAPP',
          notificationId: 'notif-001',
        })
      );
    });
  });
});

// Helper function to create mock notifications
function createMockNotification(
  id: string,
  channel: string,
  recipientId: string,
  priority: string = 'NORMAL'
): any {
  let status = 'PENDING';

  return {
    id,
    channel,
    recipientId,
    priority,
    isExpired: jest.fn().mockReturnValue(false),
    isReadyToSend: jest.fn().mockReturnValue(true),
    getStatus: jest.fn(() => status),
    queue: jest.fn(() => {
      status = 'QUEUED';
    }),
    markAsSending: jest.fn(() => {
      status = 'SENDING';
    }),
    markAsSent: jest.fn(() => {
      status = 'SENT';
    }),
    markAsFailed: jest.fn(() => {
      status = 'FAILED';
    }),
    canRetry: jest.fn().mockReturnValue(false),
    toJSON: jest.fn().mockImplementation(() => ({
      id,
      channel,
      recipientId,
      priority,
      status,
      scheduledAt: undefined,
    })),
  };
}
