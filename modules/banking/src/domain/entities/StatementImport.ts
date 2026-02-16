export type ImportStatus = 'pending' | 'processing' | 'processed' | 'failed';

export class StatementImport {
  constructor(
    public readonly id: number | undefined,
    public readonly bankAccountId: number,
    public readonly filename: string,
    public readonly fileHash: string,
    public readonly status: ImportStatus = 'pending',
    public readonly importedBy: string | null = null,
    public readonly importDate: Date = new Date(),
    public readonly periodStart: Date | null = null,
    public readonly periodEnd: Date | null = null,
    public readonly transactionCount: number = 0,
  ) {
    if (!fileHash) {
      throw new Error('File hash is required');
    }
  }
}
