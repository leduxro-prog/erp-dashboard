import {
  ISalesReadModelRepository,
  SalesReadModelDocumentUpsert,
} from '../ports/ISalesReadModelRepository';

export interface SmartBillInvoiceListPort {
  listInvoices(params: { startDate: string; endDate: string }): Promise<unknown[]>;
}

export interface SyncSmartBillSalesReadModelInput {
  startDate: string;
  endDate: string;
}

export interface SyncSmartBillSalesReadModelResult {
  startDate: string;
  endDate: string;
  fetchedDocuments: number;
  normalizedDocuments: number;
  upsertedDocuments: number;
  recomputedDailyRows: number;
}

export class SyncSmartBillSalesReadModel {
  constructor(
    private readonly repository: ISalesReadModelRepository,
    private readonly smartBillInvoicePort: SmartBillInvoiceListPort,
  ) {}

  async execute(input: SyncSmartBillSalesReadModelInput): Promise<SyncSmartBillSalesReadModelResult> {
    const window = this.assertDateWindow(input);

    const invoices = await this.smartBillInvoicePort.listInvoices({
      startDate: window.startDate,
      endDate: window.endDate,
    });

    const deduplicated = new Map<string, SalesReadModelDocumentUpsert>();
    for (const invoice of invoices) {
      const normalized = this.normalizeInvoice(invoice);
      if (!normalized) {
        continue;
      }
      const current = deduplicated.get(normalized.documentKey);
      deduplicated.set(normalized.documentKey, this.choosePreferredDocument(current, normalized));
    }

    const documents = Array.from(deduplicated.values()).sort((a, b) =>
      a.documentKey.localeCompare(b.documentKey),
    );

    const upsertedDocuments = await this.repository.upsertDocuments(documents);
    const recomputedDailyRows = await this.repository.rebuildDailyAggregates({
      startDate: window.startDate,
      endDate: window.endDate,
    });

    return {
      startDate: window.startDate,
      endDate: window.endDate,
      fetchedDocuments: invoices.length,
      normalizedDocuments: documents.length,
      upsertedDocuments,
      recomputedDailyRows,
    };
  }

  private choosePreferredDocument(
    current: SalesReadModelDocumentUpsert | undefined,
    incoming: SalesReadModelDocumentUpsert,
  ): SalesReadModelDocumentUpsert {
    if (!current) {
      return incoming;
    }

    const currentUpdated = this.toTimestamp(current.sourceUpdatedAt);
    const incomingUpdated = this.toTimestamp(incoming.sourceUpdatedAt);

    if (incomingUpdated > currentUpdated) {
      return incoming;
    }

    if (incomingUpdated < currentUpdated) {
      return current;
    }

    return this.compareDeterministicSignature(current, incoming) <= 0 ? incoming : current;
  }

  private toTimestamp(value: string | undefined): number {
    if (!value) {
      return 0;
    }

    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private compareDeterministicSignature(
    left: SalesReadModelDocumentUpsert,
    right: SalesReadModelDocumentUpsert,
  ): number {
    const leftSignature = this.buildDeterministicSignature(left);
    const rightSignature = this.buildDeterministicSignature(right);

    return leftSignature.localeCompare(rightSignature);
  }

  private buildDeterministicSignature(doc: SalesReadModelDocumentUpsert): string {
    return [
      doc.issueDate,
      doc.dueDate || '',
      doc.currency,
      doc.totalWithVat.toFixed(2),
      doc.totalWithoutVat.toFixed(2),
      doc.vatAmount.toFixed(2),
      doc.customerName || '',
      doc.customerVat || '',
      doc.series || '',
      doc.number || '',
      doc.smartbillId || '',
    ].join('|');
  }

  private normalizeInvoice(rawInvoice: unknown): SalesReadModelDocumentUpsert | null {
    const raw = this.toObject(rawInvoice);

    const issueDate = this.normalizeDate(
      raw.issueDate ?? raw.date ?? raw.invoiceDate ?? raw.createdAt ?? null,
    );
    if (!issueDate) {
      return null;
    }

    const documentType = this.normalizeText(raw.documentType ?? raw.type ?? 'invoice') || 'invoice';
    const smartbillId = this.normalizeText(raw.id ?? raw.smartbillId ?? raw.smartbillInvoiceId ?? null);
    const series = this.normalizeText(raw.seriesName ?? raw.series ?? null);
    const number = this.normalizeText(raw.number ?? raw.invoiceNumber ?? null);
    const documentKey = this.buildDocumentKey({ documentType, smartbillId, series, number, issueDate });
    if (!documentKey) {
      return null;
    }

    const customer = this.toObject(raw.client);
    const totalWithVat = this.roundMoney(
      this.toNumber(raw.totalValue ?? raw.total ?? raw.totalWithVat ?? raw.totalAmount ?? 0),
    );
    const vatAmount = this.roundMoney(this.toNumber(raw.vatValue ?? raw.vatAmount ?? raw.vat ?? 0));

    const explicitWithoutVat = this.toOptionalNumber(
      raw.totalWithoutVat ?? raw.totalValueWithoutVat ?? raw.valueWithoutVat,
    );
    const totalWithoutVat = this.roundMoney(
      typeof explicitWithoutVat === 'number' ? explicitWithoutVat : totalWithVat - vatAmount,
    );

    return {
      documentKey,
      documentType,
      smartbillId: smartbillId || undefined,
      series: series || undefined,
      number: number || undefined,
      issueDate,
      dueDate:
        this.normalizeDate(raw.dueDate ?? raw.paymentDueDate ?? raw.scadentDate ?? null) || undefined,
      customerName:
        this.normalizeText(customer.name ?? raw.companyName ?? raw.clientName ?? null) || undefined,
      customerVat:
        this.normalizeText(customer.vatCode ?? raw.companyVatCode ?? raw.vatCode ?? null) || undefined,
      currency: this.normalizeText(raw.currency ?? raw.currencyCode ?? 'RON') || 'RON',
      totalWithoutVat,
      vatAmount,
      totalWithVat,
      payload: raw,
      sourceUpdatedAt:
        this.normalizeDateTime(raw.updatedAt ?? raw.modifiedAt ?? raw.lastModifiedAt ?? null) || undefined,
    };
  }

  private buildDocumentKey(input: {
    documentType: string;
    smartbillId: string;
    series: string;
    number: string;
    issueDate: string;
  }): string | null {
    if (input.smartbillId) {
      return `${input.documentType}:${input.smartbillId}`;
    }

    if (input.series && input.number) {
      return `${input.documentType}:${input.series}:${input.number}`;
    }

    if (input.number) {
      return `${input.documentType}:${input.number}:${input.issueDate}`;
    }

    return null;
  }

  private assertDateWindow(input: SyncSmartBillSalesReadModelInput): {
    startDate: string;
    endDate: string;
  } {
    const startDate = this.parseStrictRawDate(input.startDate);
    const endDate = this.parseStrictRawDate(input.endDate);

    if (!startDate || !endDate) {
      throw new Error('startDate and endDate must be valid dates in YYYY-MM-DD format');
    }

    if (startDate > endDate) {
      throw new Error('startDate must be less than or equal to endDate');
    }

    return { startDate, endDate };
  }

  private parseStrictRawDate(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    return this.parseIsoDate(trimmed);
  }

  private parseIsoDate(value: string): string {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return '';
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      return '';
    }

    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  private normalizeDate(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    const strictDate = this.parseIsoDate(trimmed);
    if (strictDate) {
      return strictDate;
    }

    const isoDateTime = trimmed.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (!isoDateTime) {
      return '';
    }

    return this.parseIsoDate(isoDateTime[1]);
  }

  private normalizeDateTime(value: unknown): string {
    if (typeof value !== 'string' && !(value instanceof Date)) {
      return '';
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    return parsed.toISOString();
  }

  private normalizeText(value: unknown): string {
    if (typeof value !== 'string') {
      if (typeof value === 'number') {
        return String(value);
      }
      return '';
    }

    return value.trim();
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value !== 'string') {
      return 0;
    }

    const normalized = value.replace(',', '.').trim();
    if (!normalized) {
      return 0;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.replace(',', '.').trim();
    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private toObject(value: unknown): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, any>;
    }

    return {};
  }
}
