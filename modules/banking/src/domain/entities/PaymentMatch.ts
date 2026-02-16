export type MatchStatus = 'suggested' | 'confirmed' | 'rejected';
export type MatchType = 'invoice' | 'proforma' | 'order';

export class PaymentMatch {
  constructor(
    public id: number | undefined,
    public transactionId: number,
    public matchType: MatchType,
    public matchId: number,
    public amount: number,
    public confidence: number,
    public status: MatchStatus = 'suggested',
    public matchedBy: string = 'system',
    public matchedAt: Date = new Date(),
  ) {
    if (confidence < 0 || confidence > 100) {
      throw new Error('Confidence must be between 0 and 100');
    }
  }

  // Note: status is readonly but we can still update it via repository
  // The confirm/reject methods are kept for domain logic
}
