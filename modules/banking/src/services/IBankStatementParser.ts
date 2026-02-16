export interface ParsedTransaction {
  date: Date;
  amount: number;
  currency: string;
  description: string;
  reference: string | null;
  partnerName: string | null;
  partnerIban: string | null;
  rawText: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  errors: string[];
  accountInfo?: {
    accountNumber?: string;
    periodStart?: Date;
    periodEnd?: Date;
  };
}

export interface IBankStatementParser {
  getBank(): string;
  canParse(rawText: string): boolean;
  parseText(rawText: string, bankAccountId: number): ParseResult;
}
