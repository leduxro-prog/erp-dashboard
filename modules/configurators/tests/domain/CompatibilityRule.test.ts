import { describe, it, expect } from '@jest/globals';
import { CompatibilityRule } from '../../src/domain/entities/CompatibilityRule';

/**
 * CompatibilityRule Domain Entity Tests
 *
 * Tests for rule types:
 * - REQUIRES: Component requires another (e.g., track requires power supply)
 * - EXCLUDES: Components cannot coexist
 * - MAX_QUANTITY: Maximum items allowed
 * - MIN_QUANTITY: Minimum items required
 * - DISTANCE: Ratio constraint (e.g., 1 controller per 10m of strip)
 */
describe('CompatibilityRule', () => {
  describe('REQUIRES Rule', () => {
    it('should pass when required component exists', () => {
      const rule = new CompatibilityRule(
        'Track requires power supply',
        'REQUIRES',
        'TRACK_2M',
        { en: 'Track requires power supply', ro: 'Pista necesită sursă de alimentare' }
      );
      rule.targetComponentType = 'POWER_SUPPLY';

      const items = [
        { componentType: 'TRACK_2M', quantity: 1 },
        { componentType: 'POWER_SUPPLY', quantity: 1 },
      ];

      expect(rule.evaluate(items)).toBe(true);
    });

    it('should fail when required component is missing', () => {
      const rule = new CompatibilityRule(
        'Track requires power supply',
        'REQUIRES',
        'TRACK_2M',
        { en: 'Track requires power supply', ro: 'Pista necesită sursă de alimentare' }
      );
      rule.targetComponentType = 'POWER_SUPPLY';

      const items = [{ componentType: 'TRACK_2M', quantity: 1 }];

      expect(rule.evaluate(items)).toBe(false);
    });

    it('should pass when source component not present', () => {
      const rule = new CompatibilityRule(
        'Track requires power supply',
        'REQUIRES',
        'TRACK_2M',
        { en: 'Track requires power supply', ro: 'Pista necesită sursă de alimentare' }
      );
      rule.targetComponentType = 'POWER_SUPPLY';

      const items = [{ componentType: 'OTHER', quantity: 1 }];

      expect(rule.evaluate(items)).toBe(true);
    });
  });

  describe('EXCLUDES Rule', () => {
    it('should pass when excluded component is absent', () => {
      const rule = new CompatibilityRule(
        'Cannot mix connectors',
        'EXCLUDES',
        'CONNECTOR_L',
        { en: 'Cannot mix L and T connectors', ro: 'Nu se pot amesteca conectori L și T' }
      );
      rule.targetComponentType = 'CONNECTOR_T';

      const items = [{ componentType: 'CONNECTOR_L', quantity: 1 }];

      expect(rule.evaluate(items)).toBe(true);
    });

    it('should fail when excluded component exists', () => {
      const rule = new CompatibilityRule(
        'Cannot mix connectors',
        'EXCLUDES',
        'CONNECTOR_L',
        { en: 'Cannot mix L and T connectors', ro: 'Nu se pot amesteca conectori L și T' }
      );
      rule.targetComponentType = 'CONNECTOR_T';

      const items = [
        { componentType: 'CONNECTOR_L', quantity: 1 },
        { componentType: 'CONNECTOR_T', quantity: 1 },
      ];

      expect(rule.evaluate(items)).toBe(false);
    });
  });

  describe('MAX_QUANTITY Rule', () => {
    it('should pass when quantity under limit', () => {
      const rule = new CompatibilityRule(
        'Max 8 spots per 2m track',
        'MAX_QUANTITY',
        'SPOT_LED',
        { en: 'Max 8 spots per track', ro: 'Maximum 8 spoturi per pistă' }
      );
      rule.setCondition({ maxQuantity: 8 });

      const items = [{ componentType: 'SPOT_LED', quantity: 5 }];

      expect(rule.evaluate(items)).toBe(true);
    });

    it('should pass when quantity equals limit', () => {
      const rule = new CompatibilityRule(
        'Max 8 spots per 2m track',
        'MAX_QUANTITY',
        'SPOT_LED',
        { en: 'Max 8 spots per track', ro: 'Maximum 8 spoturi per pistă' }
      );
      rule.setCondition({ maxQuantity: 8 });

      const items = [{ componentType: 'SPOT_LED', quantity: 8 }];

      expect(rule.evaluate(items)).toBe(true);
    });

    it('should fail when quantity exceeds limit', () => {
      const rule = new CompatibilityRule(
        'Max 8 spots per 2m track',
        'MAX_QUANTITY',
        'SPOT_LED',
        { en: 'Max 8 spots per track', ro: 'Maximum 8 spoturi per pistă' }
      );
      rule.setCondition({ maxQuantity: 8 });

      const items = [{ componentType: 'SPOT_LED', quantity: 10 }];

      expect(rule.evaluate(items)).toBe(false);
    });

    it('should sum quantities across multiple items of same type', () => {
      const rule = new CompatibilityRule(
        'Max 8 spots per 2m track',
        'MAX_QUANTITY',
        'SPOT_LED',
        { en: 'Max 8 spots per track', ro: 'Maximum 8 spoturi per pistă' }
      );
      rule.setCondition({ maxQuantity: 8 });

      const items = [
        { componentType: 'SPOT_LED', quantity: 5 },
        { componentType: 'SPOT_LED', quantity: 4 }, // Total: 9, exceeds limit
      ];

      expect(rule.evaluate(items)).toBe(false);
    });
  });

  describe('MIN_QUANTITY Rule', () => {
    it('should pass when quantity meets minimum', () => {
      const rule = new CompatibilityRule(
        'At least 1 power supply',
        'MIN_QUANTITY',
        'POWER_SUPPLY',
        { en: 'At least 1 power supply required', ro: 'Cel puțin 1 sursă de alimentare' }
      );
      rule.setCondition({ minQuantity: 1 });

      const items = [{ componentType: 'POWER_SUPPLY', quantity: 2 }];

      expect(rule.evaluate(items)).toBe(true);
    });

    it('should fail when quantity below minimum', () => {
      const rule = new CompatibilityRule(
        'At least 1 power supply',
        'MIN_QUANTITY',
        'POWER_SUPPLY',
        { en: 'At least 1 power supply required', ro: 'Cel puțin 1 sursă de alimentare' }
      );
      rule.setCondition({ minQuantity: 1 });

      const items = [{ componentType: 'OTHER', quantity: 1 }];

      expect(rule.evaluate(items)).toBe(false);
    });
  });

  describe('DISTANCE Rule', () => {
    it('should pass when enough controllers for LED strips', () => {
      const rule = new CompatibilityRule(
        'Controller per 10m of LED',
        'DISTANCE',
        'LED_STRIP_5M',
        { en: 'Need 1 controller per 10m', ro: 'Necesită 1 controller la 10m' }
      );
      rule.targetComponentType = 'CONTROLLER';
      rule.setCondition({ distancePerUnit: 10, requiredPer: 1 });

      const items = [
        { componentType: 'LED_STRIP_5M', quantity: 15 }, // 15m total
        { componentType: 'CONTROLLER', quantity: 2 }, // Need 2 (at 10m intervals)
      ];

      expect(rule.evaluate(items)).toBe(true);
    });

    it('should fail when insufficient controllers', () => {
      const rule = new CompatibilityRule(
        'Controller per 10m of LED',
        'DISTANCE',
        'LED_STRIP_5M',
        { en: 'Need 1 controller per 10m', ro: 'Necesită 1 controller la 10m' }
      );
      rule.targetComponentType = 'CONTROLLER';
      rule.setCondition({ distancePerUnit: 10, requiredPer: 1 });

      const items = [
        { componentType: 'LED_STRIP_5M', quantity: 25 }, // 25m total
        { componentType: 'CONTROLLER', quantity: 2 }, // Need 3
      ];

      expect(rule.evaluate(items)).toBe(false);
    });
  });

  describe('Rule Activation', () => {
    it('should pass automatically when inactive', () => {
      const rule = new CompatibilityRule(
        'Inactive rule',
        'REQUIRES',
        'COMPONENT_A',
        { en: 'This rule is inactive', ro: 'Această regulă este inactivă' }
      );
      rule.isActive = false;
      rule.targetComponentType = 'COMPONENT_B';

      const items = [{ componentType: 'COMPONENT_A', quantity: 1 }];

      expect(rule.evaluate(items)).toBe(true);
    });

    it('should evaluate when active', () => {
      const rule = new CompatibilityRule(
        'Active rule',
        'REQUIRES',
        'COMPONENT_A',
        { en: 'This rule is active', ro: 'Această regulă este activă' }
      );
      rule.isActive = true;
      rule.targetComponentType = 'COMPONENT_B';

      const items = [{ componentType: 'COMPONENT_A', quantity: 1 }];

      expect(rule.evaluate(items)).toBe(false);
    });
  });

  describe('Error Messages', () => {
    it('should return English message by default', () => {
      const rule = new CompatibilityRule(
        'Test rule',
        'REQUIRES',
        'COMPONENT_A',
        { en: 'English message', ro: 'Mesaj în română' }
      );

      expect(rule.getViolationMessage()).toBe('English message');
    });

    it('should return requested locale message', () => {
      const rule = new CompatibilityRule(
        'Test rule',
        'REQUIRES',
        'COMPONENT_A',
        { en: 'English message', ro: 'Mesaj în română' }
      );

      expect(rule.getViolationMessage('ro')).toBe('Mesaj în română');
    });

    it('should fallback to English if locale not available', () => {
      const rule = new CompatibilityRule(
        'Test rule',
        'REQUIRES',
        'COMPONENT_A',
        { en: 'English message', ro: 'Mesaj în română' }
      );

      expect(rule.getViolationMessage('fr' as any)).toBe('English message');
    });
  });

  describe('Priority', () => {
    it('should initialize with priority 0', () => {
      const rule = new CompatibilityRule(
        'Test rule',
        'REQUIRES',
        'COMPONENT_A',
        { en: 'Message', ro: 'Mesaj' }
      );

      expect(rule.priority).toBe(0);
    });

    it('should allow setting custom priority', () => {
      const rule = new CompatibilityRule(
        'High priority rule',
        'REQUIRES',
        'COMPONENT_A',
        { en: 'Message', ro: 'Mesaj' }
      );
      rule.priority = 100;

      expect(rule.priority).toBe(100);
    });
  });
});
