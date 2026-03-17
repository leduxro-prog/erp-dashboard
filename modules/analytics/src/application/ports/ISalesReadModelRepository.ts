export interface DateWindow {
  startDate: string;
  endDate: string;
}

export interface SalesReadModelDocumentUpsert {
  documentKey: string;
  documentType: string;
  smartbillId?: string;
  series?: string;
  number?: string;
  issueDate: string;
  dueDate?: string;
  customerName?: string;
  customerVat?: string;
  currency: string;
  totalWithoutVat: number;
  vatAmount: number;
  totalWithVat: number;
  payload: Record<string, unknown>;
  sourceUpdatedAt?: string;
}

export interface ISalesReadModelRepository {
  upsertDocuments(documents: SalesReadModelDocumentUpsert[]): Promise<number>;
  rebuildDailyAggregates(window: DateWindow): Promise<number>;
}
