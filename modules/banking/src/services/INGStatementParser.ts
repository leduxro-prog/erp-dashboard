import { IBankStatementParser, ParseResult, ParsedTransaction } from './IBankStatementParser';

/**
 * ING Bank statement parser
 * Handles ING Romania bank statement PDF/text exports
 */
export class INGStatementParser implements IBankStatementParser {
  getBank(): string {
    return 'ING';
  }

  canParse(rawText: string): boolean {
    // Check for ING specific markers
    return (
      rawText.includes('ING Bank') ||
      rawText.includes('ING BANK') ||
      rawText.includes('Banca ING') ||
      /\bING\b/i.test(rawText)
    );
  }

  parseText(rawText: string, bankAccountId: number): ParseResult {
    const result: ParseResult = {
      transactions: [],
      errors: [],
    };

    try {
      const lines = rawText.split('\n');

      // Try to extract account information
      for (let i = 0; i < Math.min(lines.length, 50); i++) {
        const line = lines[i];

        // Account number pattern: ROxxINGB0000xxxxxxx
        const accountMatch = line.match(/(RO\d{2}INGB\d{4}\d+)/);
        if (accountMatch && !result.accountInfo?.accountNumber) {
          result.accountInfo = {
            accountNumber: accountMatch[1],
          };
        }

        // Period dates pattern
        const periodMatch = line.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
        if (periodMatch && !result.accountInfo?.periodStart) {
          result.accountInfo = result.accountInfo || {};
          result.accountInfo.periodStart = this.parseDate(periodMatch[1]);
          result.accountInfo.periodEnd = this.parseDate(periodMatch[2]);
        }
      }

      // Parse transactions
      let currentTransaction: Partial<ParsedTransaction> | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) continue;

        // Look for transaction lines
        // ING format typically: DD.MM.YYYY | Description | Amount
        const transactionPattern = /^(\d{1,2}\.\d{1,2}\.\d{4})\s+(.+)$/;
        const match = line.match(transactionPattern);

        if (match) {
          // Save previous transaction if exists
          if (currentTransaction && currentTransaction.rawText) {
            result.transactions.push(this.finalizeTransaction(currentTransaction));
          }

          const [_, dateStr, rest] = match;
          currentTransaction = {
            date: this.parseDate(dateStr),
            rawText: line,
          };

          // Parse the rest of the line
          const amountMatch = rest.match(/([+-]?\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+,\d{2})\s*(RON|EUR)?$/);
          if (amountMatch) {
            currentTransaction.amount = this.parseAmount(amountMatch[1]);
            currentTransaction.currency = amountMatch[2] || 'RON';
            const descriptionStart = rest.indexOf(amountMatch[0]);
            currentTransaction.description = rest.substring(0, descriptionStart).trim();
          } else {
            currentTransaction.description = rest;
          }

          // Extract reference
          const refMatch = rest.match(/ref[:\s]*([A-Z0-9\/-]+)/i);
          if (refMatch) {
            currentTransaction.reference = refMatch[1];
          }

          // Extract partner info (IBAN or name)
          const ibanMatch = rest.match(/(RO\d{2}[A-Z0-9]{4}\d+)/);
          if (ibanMatch) {
            currentTransaction.partnerIban = ibanMatch[1];
          }

        } else if (currentTransaction) {
          // Continuation of previous transaction line
          if (line.includes('RON') || line.includes('EUR')) {
            const amountMatch = line.match(/([+-]?\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+,\d{2})\s*(RON|EUR)?$/);
            if (amountMatch) {
              currentTransaction.amount = this.parseAmount(amountMatch[1]);
              currentTransaction.currency = amountMatch[2] || 'RON';
            }
          } else if (!currentTransaction.partnerName && line.length > 0) {
            currentTransaction.partnerName = line;
          }

          currentTransaction.rawText += '\n' + line;
        }
      }

      // Save last transaction
      if (currentTransaction && currentTransaction.rawText) {
        result.transactions.push(this.finalizeTransaction(currentTransaction));
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  private finalizeTransaction(t: Partial<ParsedTransaction>): ParsedTransaction {
    return {
      date: t.date || new Date(),
      amount: t.amount || 0,
      currency: t.currency || 'RON',
      description: t.description || '',
      reference: t.reference || null,
      partnerName: t.partnerName || null,
      partnerIban: t.partnerIban || null,
      rawText: t.rawText || '',
    };
  }

  private parseDate(dateStr: string): Date {
    // DD.MM.YYYY format
    const parts = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (parts) {
      const [, day, month, year] = parts;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    return new Date(); // Fallback
  }

  private parseAmount(amountStr: string): number {
    // Remove spaces and parse Romanian format (comma as decimal)
    const clean = amountStr.replace(/\s/g, '').replace(/,/g, '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
}
