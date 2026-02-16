/**
 * Send Message Use-Case Tests
 *
 * Tests for message sending with conversation creation and validation.
 *
 * @test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Logger } from 'winston';
import { SendMessage, SendMessageRequest } from '../../../src/application/use-cases/SendMessage';
import { IMessageRepository } from '../../../src/domain/repositories/IMessageRepository';
import { IConversationRepository } from '../../../src/domain/repositories/IConversationRepository';
import { IWhatsAppBusinessApi } from '../../../src/domain/ports/IWhatsAppBusinessApi';
import {
  InvalidPhoneError,
  ConversationClosedError,
} from '../../../src/domain/errors/whatsapp.errors';
import { ValidationError } from '@shared/errors';

// Mock repositories and API
const createMockMessageRepository = (): jest.Mocked<IMessageRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findByConversation: jest.fn(),
  findByPhone: jest.fn(),
  findPending: jest.fn(),
  updateStatus: jest.fn(),
  countUnread: jest.fn(),
  delete: jest.fn(),
});

const createMockConversationRepository = (): jest.Mocked<IConversationRepository> => ({
  save: jest.fn(),
  findById: jest.fn(),
  findByPhone: jest.fn(),
  findOpen: jest.fn(),
  findAssigned: jest.fn(),
  findAll: jest.fn(),
  search: jest.fn(),
  findResolvedBefore: jest.fn(),
  delete: jest.fn(),
});

const createMockWhatsAppApi = (): jest.Mocked<IWhatsAppBusinessApi> => ({
  sendTextMessage: jest.fn<any>().mockResolvedValue({ messageId: 'wa-msg-id', status: 'queued', timestamp: new Date() }),
  sendTemplateMessage: jest.fn<any>().mockResolvedValue({ messageId: 'wa-msg-id', status: 'queued', timestamp: new Date() }),
  sendMediaMessage: jest.fn<any>().mockResolvedValue({ messageId: 'wa-msg-id', status: 'queued', timestamp: new Date() }),
  getTemplateStatus: jest.fn(),
  markMessageRead: jest.fn(),
  uploadMedia: jest.fn(),
  healthCheck: jest.fn(),
});

const createMockLogger = (): jest.Mocked<Logger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as jest.Mocked<Logger>);

describe('SendMessage Use-Case', () => {
  let useCase: SendMessage;
  let messageRepository: jest.Mocked<IMessageRepository>;
  let conversationRepository: jest.Mocked<IConversationRepository>;
  let whatsappApi: jest.Mocked<IWhatsAppBusinessApi>;
  let logger: jest.Mocked<Logger>;

  beforeEach(() => {
    messageRepository = createMockMessageRepository();
    conversationRepository = createMockConversationRepository();
    whatsappApi = createMockWhatsAppApi();
    logger = createMockLogger();

    useCase = new SendMessage(
      messageRepository,
      conversationRepository,
      whatsappApi,
      logger
    );
  });

  describe('Validation', () => {
    it('should reject invalid phone number format', async () => {
      const request: SendMessageRequest = {
        phone: 'invalid-phone',
        content: 'Hello',
      };

      await expect(useCase.execute(request)).rejects.toThrow(InvalidPhoneError);
    });

    it('should accept E.164 format phone numbers', async () => {
      conversationRepository.findByPhone.mockResolvedValue(null);
      const savedConversation = {
        id: 'conv-001',
        getStatus: () => 'OPEN',
        isActive: () => true,
        addMessage: jest.fn(),
        customerName: 'Test',
        customerPhone: '+40723456789',
        createdAt: new Date(),
        getUpdatedAt: () => new Date(),
      };
      conversationRepository.save.mockResolvedValue(savedConversation as any);

      const savedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        getStatus: () => 'PENDING',
      };
      messageRepository.save.mockResolvedValue(savedMessage as any);

      const request: SendMessageRequest = {
        phone: '+40723456789',
        content: 'Hello',
      };

      const response = await useCase.execute(request);
      expect(response.status).toBe('pending');
    });

    it('should reject empty message content', async () => {
      const request: SendMessageRequest = {
        phone: '+40723456789',
        content: '',
      };

      await expect(useCase.execute(request)).rejects.toThrow(ValidationError);
    });

    it('should reject whitespace-only message content', async () => {
      const request: SendMessageRequest = {
        phone: '+40723456789',
        content: '   ',
      };

      await expect(useCase.execute(request)).rejects.toThrow(ValidationError);
    });

    it('should reject message exceeding max length', async () => {
      const request: SendMessageRequest = {
        phone: '+40723456789',
        content: 'a'.repeat(4097),
      };

      await expect(useCase.execute(request)).rejects.toThrow(ValidationError);
    });
  });

  describe('Conversation Management', () => {
    it('should create conversation if not exists', async () => {
      conversationRepository.findByPhone.mockResolvedValue(null);
      const savedConversation = {
        id: 'conv-001',
        getStatus: () => 'OPEN',
        isActive: () => true,
        addMessage: jest.fn(),
        customerName: 'Test',
        customerPhone: '+40723456789',
        createdAt: new Date(),
        getUpdatedAt: () => new Date(),
      };
      conversationRepository.save.mockResolvedValue(savedConversation as any);

      const savedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        getStatus: () => 'PENDING',
      };
      messageRepository.save.mockResolvedValue(savedMessage as any);

      const request: SendMessageRequest = {
        phone: '+40723456789',
        content: 'Hello',
        customerName: 'John Doe',
      };

      const response = await useCase.execute(request);

      expect(conversationRepository.save).toHaveBeenCalledTimes(2); // Create + update with message
      expect(response.conversationId).toBe('conv-001');
    });

    it('should reuse existing conversation', async () => {
      const existingConversation = {
        id: 'conv-001',
        getStatus: () => 'OPEN',
        isActive: () => true,
        addMessage: jest.fn(),
        customerName: 'John Doe',
        customerPhone: '+40723456789',
        createdAt: new Date(),
        getUpdatedAt: () => new Date(),
      };
      conversationRepository.findByPhone.mockResolvedValue(existingConversation as any);
      conversationRepository.save.mockResolvedValue(existingConversation as any);

      const savedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
      };
      messageRepository.save.mockResolvedValue(savedMessage as any);

      const request: SendMessageRequest = {
        phone: '+40723456789',
        content: 'Hello',
      };

      await useCase.execute(request);

      expect(conversationRepository.findByPhone).toHaveBeenCalledWith('+40723456789');
      expect(conversationRepository.save).toHaveBeenCalledTimes(1); // Only update with message
    });

    it('should reject message to resolved conversation', async () => {
      const resolvedConversation = {
        id: 'conv-001',
        getStatus: () => 'RESOLVED',
        isActive: () => false,
      };
      conversationRepository.findByPhone.mockResolvedValue(resolvedConversation as any);

      const request: SendMessageRequest = {
        phone: '+40723456789',
        content: 'Hello',
      };

      await expect(useCase.execute(request)).rejects.toThrow(ConversationClosedError);
    });

    it('should reject message to archived conversation', async () => {
      const archivedConversation = {
        id: 'conv-001',
        getStatus: () => 'ARCHIVED',
        isActive: () => false,
      };
      conversationRepository.findByPhone.mockResolvedValue(archivedConversation as any);

      const request: SendMessageRequest = {
        phone: '+40723456789',
        content: 'Hello',
      };

      await expect(useCase.execute(request)).rejects.toThrow(ConversationClosedError);
    });
  });

  describe('Message Creation', () => {
    it('should create message with provided customer ID', async () => {
      const savedConversation = {
        id: 'conv-001',
        getStatus: () => 'OPEN',
        isActive: () => true,
        addMessage: jest.fn(),
        customerName: 'Test',
        customerPhone: '+40723456789',
        createdAt: new Date(),
        getUpdatedAt: () => new Date(),
      };
      conversationRepository.findByPhone.mockResolvedValue(savedConversation as any);
      conversationRepository.save.mockResolvedValue(savedConversation as any);

      const savedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        getStatus: () => 'PENDING',
      };
      messageRepository.save.mockResolvedValue(savedMessage as any);

      const request: SendMessageRequest = {
        phone: '+40723456789',
        content: 'Hello',
        customerId: 'cust-123',
      };

      await useCase.execute(request);

      expect(messageRepository.save).toHaveBeenCalled();
      const savedMsg = messageRepository.save.mock.calls[0][0];
      expect(savedMsg.conversationId).toBe('conv-001');
    });

    it('should return queued status', async () => {
      const savedConversation = {
        id: 'conv-001',
        getStatus: () => 'OPEN',
        isActive: () => true,
        addMessage: jest.fn(),
        customerName: 'Test',
        customerPhone: '+40723456789',
        createdAt: new Date(),
        getUpdatedAt: () => new Date(),
      };
      conversationRepository.findByPhone.mockResolvedValue(null);
      conversationRepository.save.mockResolvedValue(savedConversation as any);

      const savedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
        getStatus: () => 'PENDING',
      };
      messageRepository.save.mockResolvedValue(savedMessage as any);

      const request: SendMessageRequest = {
        phone: '+40723456789',
        content: 'Hello',
      };

      const response = await useCase.execute(request);

      expect(response.status).toBe('pending');
      expect(response.messageId).toBeDefined();
      expect(response.conversationId).toBe('conv-001');
      expect(response.timestamp).toBeDefined();
    });
  });

  describe('Logging', () => {
    it('should log use-case start and completion', async () => {
      const savedConversation = {
        id: 'conv-001',
        getStatus: () => 'OPEN',
        isActive: () => true,
        addMessage: jest.fn(),
        customerName: 'Test',
        customerPhone: '+40723456789',
        createdAt: new Date(),
        getUpdatedAt: () => new Date(),
      };
      conversationRepository.findByPhone.mockResolvedValue(savedConversation as any);
      conversationRepository.save.mockResolvedValue(savedConversation as any);

      const savedMessage = {
        id: 'msg-001',
        conversationId: 'conv-001',
      };
      messageRepository.save.mockResolvedValue(savedMessage as any);

      const request: SendMessageRequest = {
        phone: '+40723456789',
        content: 'Hello',
      };

      await useCase.execute(request);

      expect(logger.debug).toHaveBeenCalledWith(
        'SendMessage use-case started',
        expect.objectContaining({ phone: '+40723456789' })
      );
      expect(logger.info).toHaveBeenCalledWith(
        'SendMessage use-case completed',
        expect.any(Object)
      );
    });
  });
});
