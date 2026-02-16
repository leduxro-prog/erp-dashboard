import { Queue, Worker } from 'bullmq';
import { SendReminders, ILogger } from '../../application/use-cases/SendReminders';

export class QuoteReminderJob {
  private queue: Queue;
  private worker: Worker;

  constructor(
    private sendReminders: SendReminders,
    private logger: ILogger,
    private redisConnection: any,
  ) {
    this.queue = new Queue('quote-reminders', {
      connection: redisConnection,
    });

    this.worker = new Worker(
      'quote-reminders',
      async () => {
        await this.handleReminders();
      },
      { connection: redisConnection },
    );

    this.worker.on('completed', job => {
      this.logger.info('Quote reminder job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error('Quote reminder job failed', error);
    });
  }

  async schedule(): Promise<void> {
    // Schedule daily at 09:00 UTC
    await this.queue.add(
      'send-reminders',
      {},
      {
        repeat: {
          pattern: '0 9 * * *', // Cron pattern: 09:00 every day
        },
      },
    );

    this.logger.info('Quote reminder job scheduled for 09:00 UTC daily');
  }

  private async handleReminders(): Promise<void> {
    try {
      const result = await this.sendReminders.execute();
      this.logger.info('Quote reminders sent', {
        sent: result.sent,
        errors: result.error,
      });
    } catch (error) {
      this.logger.error('Error in quote reminder job', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}
