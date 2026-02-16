import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConfiguratorSession, ConfigurationItem } from '../../src/domain/entities/ConfiguratorSession';

/**
 * ConfiguratorSession Domain Entity Tests
 *
 * Tests for:
 * - Session creation and initialization
 * - Adding/removing items
 * - Validation and expiry checks
 * - Price calculation with discounts
 * - Session status transitions
 */
describe('ConfiguratorSession', () => {
  let session: ConfiguratorSession;

  beforeEach(() => {
    session = new ConfiguratorSession('MAGNETIC_TRACK', 123);
  });

  describe('Creation and Initialization', () => {
    it('should create a new session with ACTIVE status', () => {
      expect(session.status).toBe('ACTIVE');
      expect(session.type).toBe('MAGNETIC_TRACK');
      expect(session.customerId).toBe(123);
    });

    it('should generate unique session token', () => {
      const session2 = new ConfiguratorSession('LED_STRIP');
      expect(session.sessionToken).not.toBe(session2.sessionToken);
      expect(session.sessionToken).toHaveLength(36); // UUID length
    });

    it('should set expiry to 24 hours from creation', () => {
      const now = Date.now();
      const expiryMs = session.expiresAt.getTime() - now;
      const expectedMs = 24 * 60 * 60 * 1000;

      // Allow 1 second tolerance
      expect(Math.abs(expiryMs - expectedMs)).toBeLessThan(1000);
    });

    it('should initialize with empty items', () => {
      expect(session.items.size).toBe(0);
      expect(session.totalPrice).toBe(0);
    });
  });

  describe('Adding Items', () => {
    it('should add a valid item to session', () => {
      const item = new ConfigurationItem(
        session.id,
        101,
        'TRACK_2M',
        2,
        500
      );

      session.addItem(item);

      expect(session.items.size).toBe(1);
      expect(session.items.has(item.id)).toBe(true);
    });

    it('should throw error when adding invalid item', () => {
      const item = new ConfigurationItem(session.id, 101, 'TRACK_2M', 0, 500);

      expect(() => session.addItem(item)).toThrow('Invalid configuration item');
    });

    it('should update session updatedAt when adding item', () => {
      const beforeAdd = session.updatedAt.getTime();
      const item = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);

      // Small delay to ensure time difference
      setTimeout(() => {
        session.addItem(item);
        expect(session.updatedAt.getTime()).toBeGreaterThan(beforeAdd);
      }, 10);
    });
  });

  describe('Removing Items', () => {
    it('should remove item from session', () => {
      const item = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      session.addItem(item);

      const removed = session.removeItem(item.id);

      expect(removed).toBe(true);
      expect(session.items.size).toBe(0);
    });

    it('should return false when removing non-existent item', () => {
      const removed = session.removeItem('non-existent-id');

      expect(removed).toBe(false);
    });
  });

  describe('Updating Items', () => {
    let item: ConfigurationItem;

    beforeEach(() => {
      item = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      session.addItem(item);
    });

    it('should update item quantity', () => {
      session.updateItem(item.id, { quantity: 3 });

      expect(session.items.get(item.id)?.quantity).toBe(3);
    });

    it('should throw error when updating with invalid quantity', () => {
      expect(() => {
        session.updateItem(item.id, { quantity: 0 });
      }).toThrow('Quantity must be positive');
    });

    it('should throw error when updating non-existent item', () => {
      expect(() => {
        session.updateItem('non-existent', { quantity: 2 });
      }).toThrow('Item non-existent not found');
    });
  });

  describe('Validation', () => {
    it('should validate non-empty configuration', () => {
      const item = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      session.addItem(item);

      expect(() => session.validate()).not.toThrow();
      expect(session.validatedAt).toBeDefined();
    });

    it('should throw error when validating empty configuration', () => {
      expect(() => session.validate()).toThrow('Configuration must contain at least one item');
    });

    it('should throw error when validating expired session', () => {
      // Manually set to expired
      session.expiresAt = new Date(Date.now() - 1000);
      const item = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      session.addItem(item);

      expect(() => session.validate()).toThrow('Session has expired');
    });
  });

  describe('Price Calculation', () => {
    beforeEach(() => {
      session.addItem(new ConfigurationItem(session.id, 101, 'TRACK_2M', 2, 500)); // 1000
      session.addItem(new ConfigurationItem(session.id, 102, 'SPOT_LED', 4, 100)); // 400
      // Subtotal: 1400
    });

    it('should calculate total without discounts', () => {
      session.calculateTotal(0, 0);

      expect(session.totalPrice).toBe(1400);
    });

    it('should apply volume discount', () => {
      session.calculateTotal(10, 0); // 10% volume discount

      expect(session.totalPrice).toBe(1260); // 1400 * 0.9
    });

    it('should apply tier discount', () => {
      session.calculateTotal(0, 15); // 15% tier discount

      expect(session.totalPrice).toBe(1190); // 1400 * 0.85
    });

    it('should apply both discounts in correct order', () => {
      session.calculateTotal(10, 15);

      // First volume: 1400 * 0.9 = 1260
      // Then tier: 1260 * 0.85 = 1071
      expect(session.totalPrice).toBe(1071);
    });

    it('should cap discounts at 100%', () => {
      session.calculateTotal(150, 150); // Over 100%

      expect(session.totalPrice).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Session Status', () => {
    it('should complete valid session', () => {
      session.addItem(new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500));

      session.complete();

      expect(session.status).toBe('COMPLETED');
    });

    it('should throw error completing empty session', () => {
      expect(() => session.complete()).toThrow();
    });

    it('should mark session as expired', () => {
      session.expire();

      expect(session.status).toBe('EXPIRED');
    });

    it('should detect expired sessions', () => {
      session.expiresAt = new Date(Date.now() - 1000);

      expect(session.isExpired()).toBe(true);
    });

    it('should not detect non-expired sessions', () => {
      expect(session.isExpired()).toBe(false);
    });
  });

  describe('Quote Conversion', () => {
    it('should convert to quote representation', () => {
      const item = new ConfigurationItem(session.id, 101, 'TRACK_2M', 2, 500);
      session.addItem(item);
      session.calculateTotal(0, 0);

      const quote = session.toQuote();

      expect(quote.configuratorType).toBe('MAGNETIC_TRACK');
      expect(quote.sessionId).toBe(session.id);
      expect(quote.items).toHaveLength(1);
      expect(quote.totalPrice).toBe(1000);
    });
  });

  describe('Item Ordering', () => {
    it('should return items sorted by position', () => {
      const item1 = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      const item2 = new ConfigurationItem(session.id, 102, 'SPOT_LED', 1, 100);
      const item3 = new ConfigurationItem(session.id, 103, 'POWER_SUPPLY', 1, 200);

      item1.position = 2;
      item2.position = 0;
      item3.position = 1;

      session.addItem(item1);
      session.addItem(item2);
      session.addItem(item3);

      const items = session.getItems();

      expect(items[0].componentType).toBe('SPOT_LED');
      expect(items[1].componentType).toBe('POWER_SUPPLY');
      expect(items[2].componentType).toBe('TRACK_2M');
    });
  });
});
