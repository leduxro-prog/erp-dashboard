export type TransactionStatus = 'unmatched' | 'matched' | 'ignored';

export class BankTransaction {
  constructor(
    public readonly id: number | undefined,
    public readonly importId: number,
    public readonly bankAccountId: number,
    public readonly date: Date,
    public readonly amount: number,
    public readonly currency: string,
    public readonly description: string,
    public readonly reference: string | null = null,
    public readonly partnerName: string | null = null,
    public readonly partnerIban: string | null = null,
    public readonly fingerprint: string,
    public readonly status: TransactionStatus = 'unmatched',
    public readonly createdAt: Date = new Date(),
    public readonly rawText: string | null = null,
  ) {
    if (amount === 0) {
      throw new Error('Transaction amount cannot be zero');
    }
    if (!fingerprint) {
      throw new Error('Transaction fingerprint is required');
    }
  }

  isCredit(): boolean {
    return this.amount > 0;
  }

  isDebit(): boolean {
    return this.amount < 0;
  }
}
