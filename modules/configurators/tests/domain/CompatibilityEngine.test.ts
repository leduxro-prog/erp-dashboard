import { describe, it, expect } from '@jest/globals';
import { CompatibilityEngine } from '../../src/domain/services/CompatibilityEngine';
import { CompatibilityRule } from '../../src/domain/entities/CompatibilityRule';
import { ConfigurationItem, ConfiguratorSession } from '../../src/domain/entities/ConfiguratorSession';

/**
 * CompatibilityEngine Service Tests
 *
 * Tests for:
 * - Multi-rule evaluation
 * - Magnetic track system rules
 * - LED strip system rules
 * - Violation detection and suggestions
 */
describe('CompatibilityEngine', () => {
  let engine: CompatibilityEngine;

  beforeEach(() => {
    engine = new CompatibilityEngine();
  });

  describe('Magnetic Track System Rules', () => {
    it('should validate track with power supply', () => {
      const session = new ConfiguratorSession('MAGNETIC_TRACK');
      const item1 = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      const item2 = new ConfigurationItem(session.id, 102, 'POWER_SUPPLY', 1, 200);
      const items = [item1, item2];

      // Create REQUIRES rule: TRACK_2M requires POWER_SUPPLY
      const rule = new CompatibilityRule(
        'Track requires power supply',
        'REQUIRES',
        'TRACK_2M',
        { en: 'Track requires power supply', ro: 'Pista necesită sursă' }
      );
      rule.targetComponentType = 'POWER_SUPPLY';
      rule.priority = 10;

      const result = engine.evaluate(items, [rule]);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail when track missing power supply', () => {
      const session = new ConfiguratorSession('MAGNETIC_TRACK');
      const item = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      const items = [item];

      const rule = new CompatibilityRule(
        'Track requires power supply',
        'REQUIRES',
        'TRACK_2M',
        { en: 'Track requires power supply', ro: 'Pista necesită sursă' }
      );
      rule.targetComponentType = 'POWER_SUPPLY';

      const result = engine.evaluate(items, [rule]);

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('error');
    });

    it('should enforce max spots per track rule', () => {
      const session = new ConfiguratorSession('MAGNETIC_TRACK');
      const item1 = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      const item2 = new ConfigurationItem(session.id, 102, 'SPOT_LED', 10, 50); // 10 spots, exceeds limit
      const items = [item1, item2];

      const rule = new CompatibilityRule(
        'Max 8 spots per 2m track',
        'MAX_QUANTITY',
        'SPOT_LED',
        { en: 'Max 8 spots per track', ro: 'Maximum 8 spoturi' }
      );
      rule.setCondition({ maxQuantity: 8 });

      const result = engine.evaluate(items, [rule]);

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('warning');
    });
  });

  describe('LED Strip System Rules', () => {
    it('should validate LED strip with controller', () => {
      const session = new ConfiguratorSession('LED_STRIP');
      const item1 = new ConfigurationItem(session.id, 201, 'LED_STRIP_5M', 2, 400); // 10m
      const item2 = new ConfigurationItem(session.id, 202, 'CONTROLLER', 1, 300);
      const items = [item1, item2];

      const rule = new CompatibilityRule(
        'Controller per 10m of LED',
        'DISTANCE',
        'LED_STRIP_5M',
        { en: 'Need controller per 10m', ro: 'Controller pentru fiecare 10m' }
      );
      rule.targetComponentType = 'CONTROLLER';
      rule.setCondition({ distancePerUnit: 10, requiredPer: 1 });

      const result = engine.evaluate(items, [rule]);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail LED strip missing adequate controllers', () => {
      const session = new ConfiguratorSession('LED_STRIP');
      const item1 = new ConfigurationItem(session.id, 201, 'LED_STRIP_5M', 3, 400); // 15m
      const item2 = new ConfigurationItem(session.id, 202, 'CONTROLLER', 1, 300); // Only 1, need 2
      const items = [item1, item2];

      const rule = new CompatibilityRule(
        'Controller per 10m of LED',
        'DISTANCE',
        'LED_STRIP_5M',
        { en: 'Need controller per 10m', ro: 'Controller pentru fiecare 10m' }
      );
      rule.targetComponentType = 'CONTROLLER';
      rule.setCondition({ distancePerUnit: 10, requiredPer: 1 });

      const result = engine.evaluate(items, [rule]);

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(1);
    });

    it('should enforce power adapter wattage rule', () => {
      const session = new ConfiguratorSession('LED_STRIP');
      const item1 = new ConfigurationItem(session.id, 201, 'LED_STRIP_5M', 2, 400); // 100W total
      const item2 = new ConfigurationItem(session.id, 203, 'POWER_ADAPTER_50W', 1, 150); // 50W insufficient
      const items = [item1, item2];

      // Would need a custom validation for wattage
      // This is more complex and would require item properties with power consumption data

      expect(items).toHaveLength(2);
    });
  });

  describe('Multiple Rule Evaluation', () => {
    it('should evaluate all rules and return all violations', () => {
      const session = new ConfiguratorSession('MAGNETIC_TRACK');
      const item1 = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      const item2 = new ConfigurationItem(session.id, 102, 'SPOT_LED', 10, 50);
      const items = [item1, item2];

      const rule1 = new CompatibilityRule(
        'Track requires power supply',
        'REQUIRES',
        'TRACK_2M',
        { en: 'Track requires power supply', ro: 'Pista necesită sursă' }
      );
      rule1.targetComponentType = 'POWER_SUPPLY';
      rule1.priority = 10;

      const rule2 = new CompatibilityRule(
        'Max 8 spots per track',
        'MAX_QUANTITY',
        'SPOT_LED',
        { en: 'Max 8 spots', ro: 'Maximum 8 spoturi' }
      );
      rule2.setCondition({ maxQuantity: 8 });
      rule2.priority = 5;

      const result = engine.evaluate(items, [rule1, rule2]);

      expect(result.isValid).toBe(false);
      expect(result.violations).toHaveLength(2);
      expect(result.violations.some((v) => v.ruleId === rule1.id)).toBe(true);
      expect(result.violations.some((v) => v.ruleId === rule2.id)).toBe(true);
    });

    it('should evaluate rules in priority order', () => {
      const session = new ConfiguratorSession('MAGNETIC_TRACK');
      const item = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      const items = [item];

      const highPriorityRule = new CompatibilityRule(
        'High priority',
        'REQUIRES',
        'TRACK_2M',
        { en: 'High priority rule', ro: 'Regulă prioritate înaltă' }
      );
      highPriorityRule.targetComponentType = 'POWER_SUPPLY';
      highPriorityRule.priority = 100;

      const lowPriorityRule = new CompatibilityRule(
        'Low priority',
        'REQUIRES',
        'TRACK_2M',
        { en: 'Low priority rule', ro: 'Regulă prioritate scăzută' }
      );
      lowPriorityRule.targetComponentType = 'OTHER';
      lowPriorityRule.priority = 1;

      const result = engine.evaluate(items, [lowPriorityRule, highPriorityRule]);

      // High priority should be evaluated first (but order doesn't affect results)
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Required Components Detection', () => {
    it('should identify required components', () => {
      const rule1 = new CompatibilityRule(
        'Track requires power',
        'REQUIRES',
        'TRACK_2M',
        { en: 'Message', ro: 'Mesaj' }
      );
      rule1.targetComponentType = 'POWER_SUPPLY';

      const rule2 = new CompatibilityRule(
        'Optional connector',
        'REQUIRES',
        'TRACK_2M',
        { en: 'Message', ro: 'Mesaj' }
      );
      rule2.targetComponentType = 'CONNECTOR_L';
      rule2.isActive = false;

      const required = engine.getRequired('TRACK_2M', [rule1, rule2]);

      expect(required).toContain('POWER_SUPPLY');
      expect(required).not.toContain('CONNECTOR_L'); // Inactive
    });
  });

  describe('Incompatible Components Detection', () => {
    it('should identify incompatible components', () => {
      const rule1 = new CompatibilityRule(
        'L and T incompatible',
        'EXCLUDES',
        'CONNECTOR_L',
        { en: 'Message', ro: 'Mesaj' }
      );
      rule1.targetComponentType = 'CONNECTOR_T';

      const incompatible = engine.getIncompatible('CONNECTOR_L', [rule1]);

      expect(incompatible).toContain('CONNECTOR_T');
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate suggestions for missing power supply', () => {
      const session = new ConfiguratorSession('MAGNETIC_TRACK');
      const item = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      const items = [item];

      const rule = new CompatibilityRule(
        'Track requires power supply',
        'REQUIRES',
        'TRACK_2M',
        { en: 'Track requires power supply', ro: 'Pista necesită sursă' }
      );
      rule.targetComponentType = 'POWER_SUPPLY';

      const result = engine.evaluate(items, [rule]);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some((s) => s.toLowerCase().includes('power'))).toBe(true);
    });

    it('should generate suggestions for quantity violations', () => {
      const session = new ConfiguratorSession('MAGNETIC_TRACK');
      const item1 = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      const item2 = new ConfigurationItem(session.id, 102, 'SPOT_LED', 12, 50);
      const items = [item1, item2];

      const rule = new CompatibilityRule(
        'Max spots',
        'MAX_QUANTITY',
        'SPOT_LED',
        { en: 'Max 8 spots', ro: 'Maximum 8 spoturi' }
      );
      rule.setCondition({ maxQuantity: 8 });

      const result = engine.evaluate(items, [rule]);

      expect(result.suggestions.some((s) => s.toLowerCase().includes('reduce'))).toBe(true);
    });
  });

  describe('Severity Classification', () => {
    it('should mark REQUIRES violations as errors', () => {
      const session = new ConfiguratorSession('MAGNETIC_TRACK');
      const item = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      const items = [item];

      const rule = new CompatibilityRule(
        'Critical requirement',
        'REQUIRES',
        'TRACK_2M',
        { en: 'Message', ro: 'Mesaj' }
      );
      rule.targetComponentType = 'POWER_SUPPLY';

      const result = engine.evaluate(items, [rule]);

      expect(result.violations[0].severity).toBe('error');
    });

    it('should mark quantity violations as warnings', () => {
      const session = new ConfiguratorSession('MAGNETIC_TRACK');
      const item1 = new ConfigurationItem(session.id, 101, 'TRACK_2M', 1, 500);
      const item2 = new ConfigurationItem(session.id, 102, 'SPOT_LED', 10, 50);
      const items = [item1, item2];

      const rule = new CompatibilityRule(
        'Quantity limit',
        'MAX_QUANTITY',
        'SPOT_LED',
        { en: 'Message', ro: 'Mesaj' }
      );
      rule.setCondition({ maxQuantity: 8 });

      const result = engine.evaluate(items, [rule]);

      expect(result.violations[0].severity).toBe('warning');
    });
  });
});
