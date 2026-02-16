import { QuoteStatus } from './Quote';

export class QuoteStatusMachine {
  private static readonly transitions: Map<QuoteStatus, QuoteStatus[]> = new Map([
    [QuoteStatus.PENDING, [QuoteStatus.SENT]],
    [QuoteStatus.SENT, [QuoteStatus.ACCEPTED, QuoteStatus.REJECTED, QuoteStatus.EXPIRED]],
    [QuoteStatus.ACCEPTED, []],
    [QuoteStatus.EXPIRED, []],
    [QuoteStatus.REJECTED, []],
  ]);

  static canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
    const allowedTransitions = this.transitions.get(from);
    if (!allowedTransitions) {
      return false;
    }
    return allowedTransitions.includes(to);
  }

  static getValidTransitions(from: QuoteStatus): QuoteStatus[] {
    return this.transitions.get(from) || [];
  }

  static isTerminalState(status: QuoteStatus): boolean {
    const allowedTransitions = this.transitions.get(status);
    return allowedTransitions !== undefined && allowedTransitions.length === 0;
  }
}
