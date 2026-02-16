/**
 * WhatsApp Conversation Entity Tests
 *
 * Tests for conversation lifecycle management: assign, resolve, archive, tagging.
 *
 * @test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  WhatsAppConversation,
  ConversationStatus,
  ConversationPriority,
} from '../../../src/domain/entities/WhatsAppConversation';

describe('WhatsAppConversation Entity', () => {
  let conversation: WhatsAppConversation;
  const now = new Date();

  beforeEach(() => {
    conversation = new WhatsAppConversation(
      'conv-001',
      null,
      'John Doe',
      '+40723456789',
      'OPEN',
      now,
      now
    );
  });

  describe('Conversation Lifecycle', () => {
    it('should initialize in OPEN status', () => {
      expect(conversation.getStatus()).toBe('OPEN');
    });

    it('should assign conversation to user', () => {
      conversation.assign('user-123');
      expect(conversation.getStatus()).toBe('ASSIGNED');
      expect(conversation.getAssignedToUserId()).toBe('user-123');
    });

    it('should not allow assigning to resolved conversation', () => {
      conversation.resolve();
      expect(() => conversation.assign('user-123')).toThrow();
    });

    it('should not allow assigning to archived conversation', () => {
      conversation.resolve();
      conversation.archive();
      expect(() => conversation.assign('user-123')).toThrow();
    });

    it('should resolve conversation', () => {
      conversation.resolve();
      expect(conversation.getStatus()).toBe('RESOLVED');
    });

    it('should reopen resolved conversation', () => {
      conversation.resolve();
      conversation.reopen();
      expect(conversation.getStatus()).toBe('OPEN');
    });

    it('should be idempotent when reopening non-resolved conversation', () => {
      conversation.reopen();
      expect(conversation.getStatus()).toBe('OPEN');
    });

    it('should archive resolved conversation', () => {
      conversation.resolve();
      conversation.archive();
      expect(conversation.getStatus()).toBe('ARCHIVED');
    });

    it('should not allow archiving non-resolved conversation', () => {
      expect(() => conversation.archive()).toThrow();
    });
  });

  describe('Message Tracking', () => {
    it('should track message addition', () => {
      expect(conversation.getMessageCount()).toBe(0);
      expect(conversation.getUnreadCount()).toBe(0);

      conversation.addMessage();
      expect(conversation.getMessageCount()).toBe(1);
      expect(conversation.getUnreadCount()).toBe(1);
      expect(conversation.getLastMessageAt()).toBeDefined();
    });

    it('should mark messages as read', () => {
      conversation.addMessage();
      conversation.addMessage();
      expect(conversation.getUnreadCount()).toBe(2);

      conversation.markRead();
      expect(conversation.getUnreadCount()).toBe(0);
    });

    it('should be idempotent when marking already read messages', () => {
      conversation.markRead();
      conversation.markRead();
      expect(conversation.getUnreadCount()).toBe(0);
    });
  });

  describe('Tagging', () => {
    it('should add tags', () => {
      conversation.addTag('urgent');
      expect(conversation.getTags()).toContain('urgent');
    });

    it('should not add duplicate tags', () => {
      conversation.addTag('urgent');
      conversation.addTag('urgent');
      expect(conversation.getTags().filter((t) => t === 'urgent')).toHaveLength(1);
    });

    it('should remove tags', () => {
      conversation.addTag('urgent');
      conversation.addTag('follow-up');
      conversation.removeTag('urgent');

      const tags = conversation.getTags();
      expect(tags).toContain('follow-up');
      expect(tags).not.toContain('urgent');
    });

    it('should be idempotent when removing non-existent tag', () => {
      conversation.removeTag('nonexistent');
      expect(conversation.getTags()).toHaveLength(0);
    });

    it('should support multiple tags', () => {
      conversation.addTag('urgent');
      conversation.addTag('follow-up');
      conversation.addTag('vip');

      const tags = conversation.getTags();
      expect(tags).toHaveLength(3);
      expect(tags).toContain('urgent');
      expect(tags).toContain('follow-up');
      expect(tags).toContain('vip');
    });
  });

  describe('Priority Management', () => {
    it('should initialize with NORMAL priority', () => {
      expect(conversation.getPriority()).toBe('NORMAL');
    });

    it('should set priority', () => {
      conversation.setPriority('HIGH');
      expect(conversation.getPriority()).toBe('HIGH');
    });

    it('should support LOW priority', () => {
      conversation.setPriority('LOW');
      expect(conversation.getPriority()).toBe('LOW');
    });

    it('should be idempotent when setting same priority', () => {
      conversation.setPriority('HIGH');
      conversation.setPriority('HIGH');
      expect(conversation.getPriority()).toBe('HIGH');
    });
  });

  describe('Customer Tracking', () => {
    it('should accept null customer ID initially', () => {
      expect(conversation.getCustomerId()).toBeNull();
    });

    it('should set customer ID', () => {
      conversation.setCustomerId('cust-001');
      expect(conversation.getCustomerId()).toBe('cust-001');
    });

    it('should update customer ID', () => {
      conversation.setCustomerId('cust-001');
      conversation.setCustomerId('cust-002');
      expect(conversation.getCustomerId()).toBe('cust-002');
    });

    it('should be idempotent when setting same customer ID', () => {
      conversation.setCustomerId('cust-001');
      conversation.setCustomerId('cust-001');
      expect(conversation.getCustomerId()).toBe('cust-001');
    });
  });

  describe('Activity Checking', () => {
    it('should be active when OPEN', () => {
      expect(conversation.isActive()).toBe(true);
    });

    it('should be active when ASSIGNED', () => {
      conversation.assign('user-123');
      expect(conversation.isActive()).toBe(true);
    });

    it('should not be active when RESOLVED', () => {
      conversation.resolve();
      expect(conversation.isActive()).toBe(false);
    });

    it('should not be active when ARCHIVED', () => {
      conversation.resolve();
      conversation.archive();
      expect(conversation.isActive()).toBe(false);
    });
  });

  describe('Immutability', () => {
    it('should maintain immutable properties', () => {
      expect(conversation.id).toBe('conv-001');
      expect(conversation.customerName).toBe('John Doe');
      expect(conversation.customerPhone).toBe('+40723456789');
      expect(conversation.createdAt).toEqual(now);
    });

    it('should return copy of tags array', () => {
      conversation.addTag('test');
      const tags = conversation.getTags();
      tags.push('hacked');
      expect(conversation.getTags()).not.toContain('hacked');
    });
  });
});
