import { Resend } from 'resend';
import Handlebars from 'handlebars';

export interface EmailMessage {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, any>;
}

export class ResendEmailAdapter {
  private static readonly MAX_BULK_SIZE = 100;
  private resend: Resend;
  private defaultFrom: string;
  private templates: Map<string, HandlebarsTemplateDelegate>;

  constructor(apiKey: string, defaultFrom: string = 'noreply@ledux.ro') {
    this.resend = new Resend(apiKey);
    this.defaultFrom = defaultFrom;
    this.templates = new Map();
    this.registerDefaultTemplates();
  }

  private registerDefaultTemplates(): void {
    // B2B Registration Template
    this.templates.set('b2b_registration_submitted', Handlebars.compile(`
      <h1>Solicitare înregistrare B2B primită</h1>
      <p>Bună {{companyName}},</p>
      <p>Am primit solicitarea dumneavoastră de înregistrare ca partener B2B.</p>
      <p>Număr înregistrare: <strong>{{registrationId}}</strong></p>
      <p>Echipa noastră va revizui solicitarea și vă vom contacta în cel mai scurt timp.</p>
      <br/>
      <p>Cu stimă,<br/>Echipa LEDUX</p>
    `));

    // B2B Auto-Approved Template
    this.templates.set('b2b_auto_approved', Handlebars.compile(`
      <h1>Cont B2B aprobat!</h1>
      <p>Bună {{companyName}},</p>
      <p>Contul dumneavoastră B2B a fost aprobat automat!</p>
      <ul>
        <li>Limită de credit: <strong>{{creditLimit}} RON</strong></li>
        <li>Email cont: {{email}}</li>
      </ul>
      <p>Puteți să vă conectați acum și să plasați comenzi.</p>
      <br/>
      <p>Cu stimă,<br/>Echipa LEDUX</p>
    `));

    // Order Confirmation Template
    this.templates.set('order_confirmation', Handlebars.compile(`
      <h1>Confirmare comandă</h1>
      <p>Bună {{customerName}},</p>
      <p>Comanda dumneavoastră a fost plasată cu succes!</p>
      <ul>
        <li>Număr comandă: <strong>{{orderNumber}}</strong></li>
        <li>Total: <strong>{{totalAmount}} RON</strong></li>
        <li>Status: {{status}}</li>
      </ul>
      <p>Vă mulțumim pentru comandă!</p>
      <br/>
      <p>Cu stimă,<br/>Echipa LEDUX</p>
    `));
  }

  async sendEmail(message: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      let html = message.html;

      if (message.template && this.templates.has(message.template)) {
        const template = this.templates.get(message.template)!;
        html = template(message.templateData || {});
      }

      // Ensure html is a string (fallback to text or empty string)
      const htmlContent = html || message.text || '';

      const result = await this.resend.emails.send({
        from: message.from || this.defaultFrom,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: htmlContent,
      });

      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }
  }

  private buildEmailPayload(message: EmailMessage): {
    from: string;
    to: string[];
    subject: string;
    html: string;
  } {
    let html = message.html;

    if (message.template && this.templates.has(message.template)) {
      const template = this.templates.get(message.template)!;
      html = template(message.templateData || {});
    }

    return {
      from: message.from || this.defaultFrom,
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      html: html || message.text || '',
    };
  }

  private chunkArray<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async sendBulk(messages: EmailMessage[]): Promise<{
    success: boolean;
    results: Array<{ success: boolean; messageId?: string; error?: string }>;
    totalSuccess: number;
    totalFailed: number;
  }> {
    const expandedMessages: EmailMessage[] = [];

    for (const message of messages) {
      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      if (recipients.length <= ResendEmailAdapter.MAX_BULK_SIZE) {
        expandedMessages.push(message);
        continue;
      }

      const recipientChunks = this.chunkArray(recipients, ResendEmailAdapter.MAX_BULK_SIZE);
      for (const recipientChunk of recipientChunks) {
        expandedMessages.push({
          ...message,
          to: recipientChunk,
        });
      }
    }

    const results: Array<{ success: boolean; messageId?: string; error?: string }> = [];
    const messageChunks = this.chunkArray(expandedMessages, ResendEmailAdapter.MAX_BULK_SIZE);
    const resendBatchApi = (this.resend as any).batch;
    const canUseBatchApi = !!resendBatchApi && typeof resendBatchApi.send === 'function';

    for (const chunk of messageChunks) {
      if (canUseBatchApi) {
        try {
          const payload = chunk.map((message) => this.buildEmailPayload(message));
          const response = await resendBatchApi.send(payload);
          const responseData = Array.isArray(response?.data) ? response.data : [];

          for (let i = 0; i < chunk.length; i++) {
            const item = responseData[i];
            if (item?.id) {
              results.push({ success: true, messageId: item.id });
            } else {
              results.push({
                success: false,
                error: item?.error || response?.error?.message || 'Failed to send email',
              });
            }
          }
        } catch (error: any) {
          for (let i = 0; i < chunk.length; i++) {
            results.push({
              success: false,
              error: error?.message || 'Failed to send email batch',
            });
          }
        }
      } else {
        for (const message of chunk) {
          const result = await this.sendEmail(message);
          results.push(result);
        }
      }
    }

    const totalSuccess = results.filter((result) => result.success).length;
    const totalFailed = results.length - totalSuccess;

    return {
      success: totalFailed === 0,
      results,
      totalSuccess,
      totalFailed,
    };
  }

  registerTemplate(name: string, templateString: string): void {
    this.templates.set(name, Handlebars.compile(templateString));
  }
}
