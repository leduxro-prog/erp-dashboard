/**
 * Scheduled Reports Service
 * Generates and sends automated reports (daily, weekly, monthly)
 */

import * as cron from 'node-cron';
import { DataSource } from 'typeorm';
import { QuoteAnalyticsService } from '../../application/services/QuoteAnalyticsService';
import { EmailService } from '../email/EmailService';

export interface ReportSchedule {
  id: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly';
  frequency: string; // cron expression
  enabled: boolean;
  recipients: string[]; // Email addresses
  format: 'html' | 'pdf' | 'excel';
  includeCharts: boolean;
  filters?: {
    status?: string[];
    dateRange?: number; // days
  };
}

export interface ReportData {
  period: string;
  metrics: {
    totalQuotes: number;
    sentQuotes: number;
    acceptedQuotes: number;
    rejectedQuotes: number;
    expiredQuotes: number;
    totalValue: number;
    acceptedValue: number;
    conversionRate: number;
    averageQuoteValue: number;
    averageTimeToAccept: number;
  };
  topCustomers: Array<{
    customerName: string;
    totalQuotes: number;
    totalValue: number;
    conversionRate: number;
  }>;
  topProducts: Array<{
    productName: string;
    timesQuoted: number;
    totalValue: number;
  }>;
  trends: Array<{
    date: string;
    count: number;
    value: number;
  }>;
}

export class ScheduledReportsService {
  private analyticsService: QuoteAnalyticsService;
  private emailService: EmailService;
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private schedules: ReportSchedule[] = [];

  constructor(
    private dataSource: DataSource,
    emailService?: EmailService
  ) {
    this.analyticsService = new QuoteAnalyticsService(dataSource);
    this.emailService = emailService || new EmailService();
  }

  /**
   * Initialize scheduled reports
   */
  async initialize(): Promise<void> {
    // Load schedules from database or config
    await this.loadSchedules();

    // Start all enabled schedules
    this.schedules.forEach(schedule => {
      if (schedule.enabled) {
        this.scheduleReport(schedule);
      }
    });

    console.log(`Initialized ${this.cronJobs.size} scheduled reports`);
  }

  /**
   * Load report schedules from database
   */
  private async loadSchedules(): Promise<void> {
    // Default schedules
    this.schedules = [
      {
        id: 'daily-summary',
        name: 'Daily Quote Summary',
        type: 'daily',
        frequency: '0 8 * * *', // 8:00 AM daily
        enabled: true,
        recipients: [process.env.REPORT_EMAIL || 'admin@ledux.ro'],
        format: 'html',
        includeCharts: true,
        filters: { dateRange: 1 },
      },
      {
        id: 'weekly-performance',
        name: 'Weekly Performance Report',
        type: 'weekly',
        frequency: '0 9 * * 1', // 9:00 AM every Monday
        enabled: true,
        recipients: [process.env.REPORT_EMAIL || 'admin@ledux.ro'],
        format: 'html',
        includeCharts: true,
        filters: { dateRange: 7 },
      },
      {
        id: 'monthly-insights',
        name: 'Monthly Business Insights',
        type: 'monthly',
        frequency: '0 10 1 * *', // 10:00 AM on 1st of month
        enabled: true,
        recipients: [process.env.REPORT_EMAIL || 'admin@ledux.ro'],
        format: 'html',
        includeCharts: true,
        filters: { dateRange: 30 },
      },
    ];

    // TODO: Load custom schedules from database
    // const customSchedules = await this.dataSource.query('SELECT * FROM report_schedules WHERE enabled = true');
    // this.schedules.push(...customSchedules);
  }

  /**
   * Schedule a report
   */
  private scheduleReport(schedule: ReportSchedule): void {
    const job = cron.schedule(schedule.frequency, async () => {
      await this.generateAndSendReport(schedule);
    });

    this.cronJobs.set(schedule.id, job);
    console.log(`Scheduled report: ${schedule.name} (${schedule.frequency})`);
  }

  /**
   * Generate and send report
   */
  private async generateAndSendReport(schedule: ReportSchedule): Promise<void> {
    try {
      console.log(`Generating report: ${schedule.name}`);

      // Get date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (schedule.filters?.dateRange || 1));

      // Collect data
      const metrics = await this.analyticsService.getQuoteMetrics(startDate, endDate);
      const topCustomers = await this.analyticsService.getTopCustomers(5);
      const topProducts = await this.analyticsService.getTopProducts(5);
      const trends = await this.analyticsService.getQuoteTrends(startDate, endDate, 'day');

      const reportData: ReportData = {
        period: this.formatPeriod(schedule.type, startDate, endDate),
        metrics,
        topCustomers,
        topProducts,
        trends,
      };

      // Generate report content
      const html = this.generateHtmlReport(schedule, reportData);
      const subject = `${schedule.name} - ${reportData.period}`;

      // Send to all recipients
      for (const recipient of schedule.recipients) {
        await this.emailService.sendEmail({
          to: recipient,
          subject,
          html,
          text: this.generateTextReport(reportData),
        });
      }

      console.log(`Report sent: ${schedule.name} to ${schedule.recipients.length} recipients`);

      // Log report generation
      await this.logReportGeneration(schedule.id, true);
    } catch (error) {
      console.error(`Failed to generate report ${schedule.name}:`, error);
      await this.logReportGeneration(schedule.id, false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(schedule: ReportSchedule, data: ReportData): string {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('ro-RO', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
      }).format(value);
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; opacity: 0.9; }
    .content { padding: 30px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
    .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
    .metric-value { font-size: 32px; font-weight: bold; color: #667eea; margin: 10px 0; }
    .metric-label { font-size: 14px; color: #6c757d; text-transform: uppercase; }
    .section { margin: 30px 0; }
    .section-title { font-size: 20px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; }
    td { padding: 12px; border-bottom: 1px solid #dee2e6; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; }
    .positive { color: #28a745; }
    .negative { color: #dc3545; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ${schedule.name}</h1>
      <p>${data.period}</p>
    </div>

    <div class="content">
      <!-- Key Metrics -->
      <div class="metrics">
        <div class="metric-card">
          <div class="metric-label">Total Oferte</div>
          <div class="metric-value">${data.metrics.totalQuotes}</div>
          <div class="${data.metrics.totalQuotes > 0 ? 'positive' : ''}">
            ${data.metrics.sentQuotes} trimise
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Valoare Totală</div>
          <div class="metric-value">${formatCurrency(data.metrics.totalValue)}</div>
          <div class="positive">${formatCurrency(data.metrics.acceptedValue)} acceptată</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Rată Conversie</div>
          <div class="metric-value">${data.metrics.conversionRate.toFixed(1)}%</div>
          <div>${data.metrics.acceptedQuotes} acceptate</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Valoare Medie</div>
          <div class="metric-value">${formatCurrency(data.metrics.averageQuoteValue)}</div>
          <div>per ofertă</div>
        </div>
      </div>

      <!-- Status Breakdown -->
      <div class="section">
        <div class="section-title">Status Oferte</div>
        <table>
          <tr>
            <td>Trimise</td>
            <td><strong>${data.metrics.sentQuotes}</strong></td>
            <td>${((data.metrics.sentQuotes / data.metrics.totalQuotes) * 100).toFixed(1)}%</td>
          </tr>
          <tr>
            <td>Acceptate</td>
            <td><strong>${data.metrics.acceptedQuotes}</strong></td>
            <td class="positive">${((data.metrics.acceptedQuotes / data.metrics.totalQuotes) * 100).toFixed(1)}%</td>
          </tr>
          <tr>
            <td>Refuzate</td>
            <td><strong>${data.metrics.rejectedQuotes}</strong></td>
            <td class="negative">${((data.metrics.rejectedQuotes / data.metrics.totalQuotes) * 100).toFixed(1)}%</td>
          </tr>
          <tr>
            <td>Expirate</td>
            <td><strong>${data.metrics.expiredQuotes}</strong></td>
            <td>${((data.metrics.expiredQuotes / data.metrics.totalQuotes) * 100).toFixed(1)}%</td>
          </tr>
        </table>
      </div>

      <!-- Top Customers -->
      <div class="section">
        <div class="section-title">Top 5 Clienți</div>
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Oferte</th>
              <th>Valoare</th>
              <th>Conversie</th>
            </tr>
          </thead>
          <tbody>
            ${data.topCustomers.map(c => `
              <tr>
                <td>${c.customerName}</td>
                <td>${c.totalQuotes}</td>
                <td>${formatCurrency(c.totalValue)}</td>
                <td>${c.conversionRate.toFixed(0)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Top Products -->
      <div class="section">
        <div class="section-title">Top 5 Produse</div>
        <table>
          <thead>
            <tr>
              <th>Produs</th>
              <th>Oferte</th>
              <th>Valoare</th>
            </tr>
          </thead>
          <tbody>
            ${data.topProducts.map(p => `
              <tr>
                <td>${p.productName}</td>
                <td>${p.timesQuoted}</td>
                <td>${formatCurrency(p.totalValue)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer">
      <p><strong>CYPHER ERP</strong> - Automated Report</p>
      <p>Generated on ${new Date().toLocaleString('ro-RO')}</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate text report (for email clients that don't support HTML)
   */
  private generateTextReport(data: ReportData): string {
    return `
${data.period}

KEY METRICS:
- Total Quotes: ${data.metrics.totalQuotes}
- Total Value: ${data.metrics.totalValue.toFixed(2)} EUR
- Conversion Rate: ${data.metrics.conversionRate.toFixed(1)}%
- Average Quote Value: ${data.metrics.averageQuoteValue.toFixed(2)} EUR

STATUS BREAKDOWN:
- Sent: ${data.metrics.sentQuotes}
- Accepted: ${data.metrics.acceptedQuotes}
- Rejected: ${data.metrics.rejectedQuotes}
- Expired: ${data.metrics.expiredQuotes}

TOP 5 CUSTOMERS:
${data.topCustomers.map((c, i) => `${i + 1}. ${c.customerName} - ${c.totalValue.toFixed(2)} EUR (${c.totalQuotes} quotes)`).join('\n')}

TOP 5 PRODUCTS:
${data.topProducts.map((p, i) => `${i + 1}. ${p.productName} - ${p.totalValue.toFixed(2)} EUR (${p.timesQuoted} quotes)`).join('\n')}

---
CYPHER ERP - Automated Report
Generated on ${new Date().toLocaleString('ro-RO')}
    `.trim();
  }

  /**
   * Format period string
   */
  private formatPeriod(type: string, startDate: Date, endDate: Date): string {
    const start = startDate.toLocaleDateString('ro-RO');
    const end = endDate.toLocaleDateString('ro-RO');

    switch (type) {
      case 'daily':
        return `Raport Zilnic - ${start}`;
      case 'weekly':
        return `Raport Săptămânal - ${start} - ${end}`;
      case 'monthly':
        return `Raport Lunar - ${startDate.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })}`;
      default:
        return `${start} - ${end}`;
    }
  }

  /**
   * Log report generation
   */
  private async logReportGeneration(
    scheduleId: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    // TODO: Implement logging to database
    console.log(`Report log: ${scheduleId}, success: ${success}, error: ${errorMessage || 'none'}`);
  }

  /**
   * Stop all scheduled reports
   */
  stop(): void {
    this.cronJobs.forEach((job, id) => {
      job.stop();
      console.log(`Stopped report: ${id}`);
    });

    this.cronJobs.clear();
  }

  /**
   * Manually trigger a report
   */
  async triggerReport(scheduleId: string): Promise<void> {
    const schedule = this.schedules.find(s => s.id === scheduleId);

    if (!schedule) {
      throw new Error(`Report schedule not found: ${scheduleId}`);
    }

    await this.generateAndSendReport(schedule);
  }
}
