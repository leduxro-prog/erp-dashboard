import { IBankStatementParser } from './IBankStatementParser';
import { INGStatementParser } from './INGStatementParser';
import { BTStatementParser } from './BTStatementParser';

/**
 * Factory for creating bank statement parsers based on content
 */
export class ParserFactory {
  private static parsers: IBankStatementParser[] = [
    new INGStatementParser(),
    new BTStatementParser(),
  ];

  static getParser(rawText: string): IBankStatementParser | null {
    for (const parser of this.parsers) {
      if (parser.canParse(rawText)) {
        return parser;
      }
    }
    return null;
  }

  static getParserByBank(bank: string): IBankStatementParser | null {
    const parser = this.parsers.find(p => p.getBank().toUpperCase() === bank.toUpperCase());
    return parser || null;
  }

  static getSupportedBanks(): string[] {
    return this.parsers.map(p => p.getBank());
  }
}
