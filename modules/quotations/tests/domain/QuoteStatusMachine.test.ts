import { QuoteStatusMachine } from '../../src/domain/entities/QuoteStatusMachine';
import { QuoteStatus } from '../../src/domain/entities/Quote';

describe('QuoteStatusMachine', () => {
  describe('canTransition', () => {
    test('should allow transition from PENDING to SENT', () => {
      const result = QuoteStatusMachine.canTransition(QuoteStatus.PENDING, QuoteStatus.SENT);
      expect(result).toBe(true);
    });

    test('should not allow transition from PENDING to ACCEPTED', () => {
      const result = QuoteStatusMachine.canTransition(QuoteStatus.PENDING, QuoteStatus.ACCEPTED);
      expect(result).toBe(false);
    });

    test('should allow transition from SENT to ACCEPTED', () => {
      const result = QuoteStatusMachine.canTransition(QuoteStatus.SENT, QuoteStatus.ACCEPTED);
      expect(result).toBe(true);
    });

    test('should allow transition from SENT to REJECTED', () => {
      const result = QuoteStatusMachine.canTransition(QuoteStatus.SENT, QuoteStatus.REJECTED);
      expect(result).toBe(true);
    });

    test('should allow transition from SENT to EXPIRED', () => {
      const result = QuoteStatusMachine.canTransition(QuoteStatus.SENT, QuoteStatus.EXPIRED);
      expect(result).toBe(true);
    });

    test('should not allow transitions from terminal states', () => {
      expect(QuoteStatusMachine.canTransition(QuoteStatus.ACCEPTED, QuoteStatus.PENDING)).toBe(false);
      expect(QuoteStatusMachine.canTransition(QuoteStatus.REJECTED, QuoteStatus.PENDING)).toBe(false);
      expect(QuoteStatusMachine.canTransition(QuoteStatus.EXPIRED, QuoteStatus.PENDING)).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    test('should return valid transitions for PENDING status', () => {
      const transitions = QuoteStatusMachine.getValidTransitions(QuoteStatus.PENDING);
      expect(transitions).toEqual([QuoteStatus.SENT]);
    });

    test('should return valid transitions for SENT status', () => {
      const transitions = QuoteStatusMachine.getValidTransitions(QuoteStatus.SENT);
      expect(transitions).toContain(QuoteStatus.ACCEPTED);
      expect(transitions).toContain(QuoteStatus.REJECTED);
      expect(transitions).toContain(QuoteStatus.EXPIRED);
    });

    test('should return empty array for terminal states', () => {
      expect(QuoteStatusMachine.getValidTransitions(QuoteStatus.ACCEPTED)).toEqual([]);
      expect(QuoteStatusMachine.getValidTransitions(QuoteStatus.REJECTED)).toEqual([]);
      expect(QuoteStatusMachine.getValidTransitions(QuoteStatus.EXPIRED)).toEqual([]);
    });
  });

  describe('isTerminalState', () => {
    test('should identify ACCEPTED as terminal state', () => {
      expect(QuoteStatusMachine.isTerminalState(QuoteStatus.ACCEPTED)).toBe(true);
    });

    test('should identify REJECTED as terminal state', () => {
      expect(QuoteStatusMachine.isTerminalState(QuoteStatus.REJECTED)).toBe(true);
    });

    test('should identify EXPIRED as terminal state', () => {
      expect(QuoteStatusMachine.isTerminalState(QuoteStatus.EXPIRED)).toBe(true);
    });

    test('should not identify PENDING as terminal state', () => {
      expect(QuoteStatusMachine.isTerminalState(QuoteStatus.PENDING)).toBe(false);
    });

    test('should not identify SENT as terminal state', () => {
      expect(QuoteStatusMachine.isTerminalState(QuoteStatus.SENT)).toBe(false);
    });
  });
});
