import { Queue, Worker } from 'bullmq';
import { ExpireOverdueQuotes, ILogger } from '../../application/use-cases/ExpireOverdueQuotes';

export class QuoteExpirationJob {
  private queue: Queue;
  private worker: Worker;

  constructor(
    private expireOverdueQuotes: ExpireOverdueQuotes,
    private logger: ILogger,
    private redisConnection: any,
  ) {
    this.queue = new Queue('quote-expiration', {
      connection: redisConnection,
    });

    this.worker = new Worker(
      'quote-expiration',
      async () => {
        await this.handleExpiration();
      },
      { connection: redisConnection },
    );

    this.worker.on('completed', job => {
      this.logger.info('Quote expiration job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error('Quote expiration job failed', error);
    });
  }

  async schedule(): Promise<void> {
    // Schedule daily at 00:30 UTC
    await this.queue.add(
      'expire-quotes',
      {},
      {
        repeat: {
          pattern: '30 0 * * *', // Cron pattern: 00:30 every day
        },
      },
    );

    this.logger.info('Quote expiration job scheduled for 00:30 UTC daily');
  }

  private async handleExpiration(): Promise<void> {
    try {
      const result = await this.expireOverdueQuotes.execute();
      this.logger.info('Expired quotes', {
        count: result.expired,
        errors: result.error,
      });
    } catch (error) {
      this.logger.error('Error in quote expiration job', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}
