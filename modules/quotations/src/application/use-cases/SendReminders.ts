import { IQuoteRepository } from '../../domain/repositories/IQuoteRepository';
import { QuoteStatus } from '../../domain/entities/Quote';

export interface IReminderService {
  sendExpirationReminder(
    email: string,
    customerName: string,
    quoteNumber: string,
    daysLeft: number,
  ): Promise<void>;
}

export interface ILogger {
  info(message: string, data?: any): void;
  error(message: string, error?: any): void;
}

export class SendReminders {
  private readonly reminderDays = [14, 10, 5]; // Days before expiration to send reminders

  constructor(
    private quoteRepository: IQuoteRepository,
    private reminderService: IReminderService,
    private logger: ILogger,
  ) {}

  async execute(): Promise<{ sent: number; error: number }> {
    let sentCount = 0;
    let errorCount = 0;

    try {
      const pendingAndSentQuotes =
        await this.quoteRepository.findPendingOrSentQuotes();

      for (const quote of pendingAndSentQuotes) {
        const daysLeft = quote.daysUntilExpiry();

        for (const reminderDay of this.reminderDays) {
          if (quote.needsReminder(reminderDay)) {
            try {
              await this.reminderService.sendExpirationReminder(
                quote.customerEmail,
                quote.customerName,
                quote.quoteNumber,
                daysLeft,
              );

              sentCount++;
              this.logger.info(`Reminder sent for quote ${quote.quoteNumber}`, {
                quoteId: quote.id,
                daysLeft,
                sentAt: new Date(),
              });
            } catch (error) {
              errorCount++;
              this.logger.error(
                `Failed to send reminder for quote ${quote.quoteNumber}`,
                error,
              );
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to execute SendReminders job', error);
    }

    return { sent: sentCount, error: errorCount };
  }
}
