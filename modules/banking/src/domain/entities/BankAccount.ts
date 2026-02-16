export type BankType = 'ING' | 'BT';

export class BankAccount {
  constructor(
    public readonly id: number | undefined,
    public readonly name: string,
    public readonly iban: string,
    public readonly bankName: string,
    public readonly currency: string = 'RON',
    public readonly createdAt: Date = new Date(),
  ) {
    if (!name || name.trim().length === 0) {
      throw new Error('Bank account name is required');
    }
    if (!iban || iban.trim().length === 0) {
      throw new Error('IBAN is required');
    }
  }
}
