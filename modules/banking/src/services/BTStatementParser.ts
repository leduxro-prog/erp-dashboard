import { IBankStatementParser, ParseResult, ParsedTransaction } from './IBankStatementParser';

/**
 * Banca Transilvania statement parser
 * Handles BT Romania statement PDF/text exports.
 */
export class BTStatementParser implements IBankStatementParser {
  getBank(): string {
    return 'BT';
  }

  canParse(rawText: string): boolean {
    return (
      rawText.includes('Banca Transilvania') ||
      rawText.includes('BANCA TRANSILVANIA') ||
      /\bBT\b/.test(rawText)
    );
  }

  parseText(rawText: string, _bankAccountId: number): ParseResult {
    const result: ParseResult = {
      transactions: [],
      errors: [],
    };

    try {
      const lines = rawText.split('\n');
      let current: Partial<ParsedTransaction> | null = null;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // Common BT format in exports often includes a booking date at start
        // Example: 14.02.2026 <desc> <amount> RON
        const m = line.match(/^(\d{1,2}\.\d{1,2}\.\d{4})\s+(.+)$/);
        if (m) {
          if (current?.rawText) {
            result.transactions.push(this.finalize(current));
          }
          current = { date: this.parseDate(m[1]), rawText: line };

          const rest = m[2];
          const amountMatch = rest.match(/([+-]?\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+,\d{2})\s*(RON|EUR)?$/);
          if (amountMatch) {
            current.amount = this.parseAmount(amountMatch[1]);
            current.currency = amountMatch[2] || 'RON';
            const descStart = rest.indexOf(amountMatch[0]);
            current.description = rest.substring(0, descStart).trim();
          } else {
            current.description = rest;
          }

          const ibanMatch = rest.match(/(RO\d{2}[A-Z0-9]{4}\d+)/);
          if (ibanMatch) {
            current.partnerIban = ibanMatch[1];
          }

          const refMatch = rest.match(/(INV-[A-Z0-9-]+|PF-[A-Z0-9-]+|B2B-[A-Z0-9-]+)/i);
          if (refMatch) {
            current.reference = refMatch[1];
          }

          continue;
        }

        if (current) {
          current.rawText = (current.rawText || '') + '\n' + line;
          if (!current.partnerName && line.length > 0 && !/\bRON\b|\bEUR\b/.test(line)) {
            current.partnerName = line;
          }
        }
      }

      if (current?.rawText) {
        result.transactions.push(this.finalize(current));
      }
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }

    return result;
  }

  private finalize(t: Partial<ParsedTransaction>): ParsedTransaction {
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
    const parts = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (parts) {
      const [, day, month, year] = parts;
      return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    }
    return new Date();
  }

  private parseAmount(amountStr: string): number {
    const clean = amountStr.replace(/\s/g, '').replace(/,/g, '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
}
