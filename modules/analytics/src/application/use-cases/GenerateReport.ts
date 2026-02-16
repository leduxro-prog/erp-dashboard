import { Logger } from 'winston';
import { Report, ReportDTO, ExportFormat } from '../../domain/entities/Report';
import { IReportRepository } from '../../domain/repositories/IReportRepository';
import { IOrderDataPort } from '../ports/IOrderDataPort';
import { IInventoryDataPort } from '../ports/IInventoryDataPort';
import { ICustomerDataPort } from '../ports/ICustomerDataPort';
import { ISupplierDataPort } from '../ports/ISupplierDataPort';
import { INotificationPort } from '../ports/INotificationPort';
import { ReportNotFoundError, ReportGenerationError } from '../../domain/errors/analytics.errors';

/**
 * GenerateReport Use-Case
 *
 * Generates an analytics report in the requested format (PDF, Excel, CSV)
 * and optionally sends it to recipients via email.
 *
 * Supports multiple report types:
 * - SALES_SUMMARY: Revenue, orders, top products
 * - CUSTOMER_ANALYSIS: Customer metrics, retention, LTV
 * - INVENTORY_REPORT: Stock levels, turnover, alerts
 * - SUPPLIER_PERFORMANCE: Delivery times, reliability
 * - FINANCIAL_OVERVIEW: Revenue, costs, margins
 * - CUSTOM: User-defined report
 *
 * @class GenerateReport
 */
export class GenerateReport {
  /**
   * Create a new GenerateReport use-case
   */
  constructor(
    private readonly reportRepository: IReportRepository,
    private readonly orderDataPort: IOrderDataPort,
    private readonly inventoryDataPort: IInventoryDataPort,
    private readonly customerDataPort: ICustomerDataPort,
    private readonly supplierDataPort: ISupplierDataPort,
    private readonly notificationPort: INotificationPort,
    private readonly logger: Logger
  ) { }

  /**
   * Execute: Generate a report
   *
   * @param reportId - ID of report to generate
   * @param sendToRecipients - Whether to email recipients (default: false)
   * @returns Promise resolving to generated report data and Buffer
   * @throws ReportNotFoundError if report doesn't exist
   * @throws ReportGenerationError if generation fails
   */
  public async execute(
    reportId: string,
    sendToRecipients: boolean = false
  ): Promise<{ report: ReportDTO; buffer: Buffer }> {
    this.logger.info('Generating report', { reportId, sendToRecipients });

    try {
      // Fetch report definition
      const report = await this.reportRepository.findById(reportId);
      if (!report) {
        throw new ReportNotFoundError(reportId);
      }

      // Gather data for report
      this.logger.debug('Gathering report data', { reportType: report.type });
      const reportData = await this.gatherReportData(report);

      // Generate report in requested format
      this.logger.debug('Generating report file', { format: report.format });
      const buffer = await this.generateReportFile(reportData, report.format);

      // Update report metadata
      report.generate(this.getDateRange(report));
      await this.reportRepository.save(report);

      // Send to recipients if requested
      if (sendToRecipients && report.recipientEmails.length > 0) {
        this.logger.debug('Sending report to recipients', {
          recipientCount: report.recipientEmails.length,
        });

        await Promise.all(
          report.recipientEmails.map((email) =>
            this.notificationPort.sendReport(email, buffer, report.format as ExportFormat)
          )
        );

        this.logger.info('Report sent to recipients', {
          reportId,
          recipientCount: report.recipientEmails.length,
        });
      }

      this.logger.info('Report generated successfully', {
        reportId,
        size: buffer.length,
      });

      return { report, buffer };
    } catch (error) {
      if (error instanceof ReportNotFoundError) {
        throw error;
      }

      this.logger.error('Failed to generate report', {
        reportId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new ReportGenerationError(
        `Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gather data required for the report
   *
   * @param report - Report definition
   * @returns Report data to be formatted
   */
  private async gatherReportData(report: Report): Promise<Record<string, unknown>> {
    const dateRange = this.getDateRange(report);

    switch (report.type) {
      case 'SALES_SUMMARY':
        return (await this.orderDataPort.getOrderMetrics(dateRange, report.filters as any)) as unknown as Record<string, unknown>;

      case 'CUSTOMER_ANALYSIS':
        return (await this.customerDataPort.getCustomerMetrics(dateRange)) as unknown as Record<string, unknown>;

      case 'INVENTORY_REPORT':
        return (await this.inventoryDataPort.getInventoryMetrics()) as unknown as Record<string, unknown>;

      case 'SUPPLIER_PERFORMANCE':
        return {
          suppliers: await this.supplierDataPort.getSupplierMetrics(dateRange),
        };

      case 'FINANCIAL_OVERVIEW':
        // Combine multiple data sources for financial report
        const [orders, customers] = await Promise.all([
          this.orderDataPort.getOrderMetrics(dateRange),
          this.customerDataPort.getCustomerMetrics(dateRange),
        ]);
        return { orders, customers };

      case 'CUSTOM':
        // Custom reports would use custom data gathering logic
        return {};

      default:
        throw new ReportGenerationError(`Unsupported report type: ${report.type}`);
    }
  }

  /**
   * Generate report file in requested format
   *
   * @param data - Report data
   * @param format - Output format (PDF, EXCEL, CSV)
   * @returns Buffer containing report file
   */
  private async generateReportFile(
    data: Record<string, unknown>,
    format: string
  ): Promise<Buffer> {
    // In production, use libraries like:
    // - PDF: pdfkit, puppeteer, html2pdf
    // - Excel: xlsx, exceljs
    // - CSV: csv-writer, fast-csv

    switch (format) {
      case 'PDF': {
        // Placeholder: in production use pdfkit or html2pdf
        const jsonStr = JSON.stringify(data, null, 2);
        return Buffer.from(`PDF Report\n\n${jsonStr}`);
      }

      case 'EXCEL': {
        // Placeholder: in production use xlsx or exceljs
        const jsonStr = JSON.stringify(data, null, 2);
        return Buffer.from(`Excel Report\n\n${jsonStr}`);
      }

      case 'CSV': {
        // Placeholder: in production use csv-writer
        const jsonStr = JSON.stringify(data, null, 2);
        return Buffer.from(`CSV Report\n\n${jsonStr}`);
      }

      default:
        throw new ReportGenerationError(`Unsupported format: ${format}`);
    }
  }

  /**
   * Get date range for report
   * Uses filters if available, otherwise defaults to current month
   *
   * @param report - Report definition
   * @returns Date range
   */
  private getDateRange(report: Report) {
    if (report.filters?.dateRange) {
      return report.filters.dateRange;
    }

    // Default to current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      startDate: startOfMonth,
      endDate: now,
    };
  }
}
