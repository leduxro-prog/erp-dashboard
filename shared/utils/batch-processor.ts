/**
 * Enterprise Batch Processor
 *
 * High-performance batch processing engine for bulk operations.
 * Handles 100K+ items efficiently with:
 * - Configurable batch size and concurrency
 * - Backpressure management to prevent memory overflow
 * - Exponential backoff retry logic for transient failures
 * - Progress tracking and estimation
 * - Multiple error handling strategies
 * - Rate limiting for API-sensitive operations
 * - Cancellation support via AbortController
 *
 * @module shared/utils/batch-processor
 * @example
 * // Create processor
 * const processor = new BatchProcessor({
 *   batchSize: 500,
 *   concurrency: 10,
 *   retryAttempts: 3,
 *   errorStrategy: 'continue-on-error',
 *   rateLimitPerSecond: 100,
 *   onProgress: (progress) => {
 *     console.log(`Processing: ${progress.percentComplete.toFixed(1)}%`);
 *   }
 * });
 *
 * // Process items
 * const result = await processor.process(
 *   items,
 *   async (batch) => {
 *     return await api.processItems(batch);
 *   },
 *   abortSignal
 * );
 *
 * console.log(`Success: ${result.successCount}, Failures: ${result.failureCount}`);
 */

import { createModuleLogger } from './logger';

const logger = createModuleLogger('batch-processor');

/**
 * Batch processing configuration options
 *
 * @interface BatchProcessorOptions
 * @property {number} batchSize - Items per batch (default: 100)
 * @property {number} concurrency - Concurrent batch operations (default: 4)
 * @property {number} retryAttempts - Retry attempts per batch (default: 3)
 * @property {'stop-on-error'|'continue-on-error'|'collect-errors'} errorStrategy - Error handling strategy
 * @property {number} backpressureThreshold - Max concurrent batches before waiting (default: concurrency * 2)
 * @property {number} rateLimitPerSecond - Rate limit for operations (0 = unlimited)
 * @property {Function} onProgress - Progress callback function
 */
export interface BatchProcessorOptions {
  batchSize?: number;
  concurrency?: number;
  retryAttempts?: number;
  errorStrategy?: 'stop-on-error' | 'continue-on-error' | 'collect-errors';
  backpressureThreshold?: number;
  rateLimitPerSecond?: number;
  onProgress?: (progress: BatchProgress) => void;
}

/**
 * Progress tracking information for batch processing
 *
 * @interface BatchProgress
 * @property {number} totalItems - Total items to process
 * @property {number} processedItems - Items completed successfully
 * @property {number} failedItems - Items that failed
 * @property {number} skippedItems - Items that were skipped
 * @property {number} percentComplete - Completion percentage (0-100)
 * @property {number} currentBatch - Current batch number
 * @property {number} totalBatches - Total number of batches
 * @property {number} estimatedTimeRemainingMs - Estimated time to completion (milliseconds)
 * @property {number} elapsedTimeMs - Time elapsed since start (milliseconds)
 */
export interface BatchProgress {
  totalItems: number;
  processedItems: number;
  failedItems: number;
  skippedItems: number;
  percentComplete: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemainingMs?: number;
  elapsedTimeMs: number;
}

/**
 * Result of batch processing operation
 *
 * @interface BatchResult
 * @typeParam TOutput - Type of processed output items
 * @property {TOutput[]} results - Successfully processed results
 * @property {number} successCount - Number of items processed successfully
 * @property {number} failureCount - Number of items that failed
 * @property {number} skipCount - Number of items that were skipped
 * @property {number} totalProcessingTimeMs - Total time spent processing (milliseconds)
 * @property {Error[]} errors - Array of errors encountered during processing
 * @property {number[]} skippedItems - Indices of skipped items in original array
 */
export interface BatchResult<TOutput> {
  results: TOutput[];
  successCount: number;
  failureCount: number;
  skipCount: number;
  totalProcessingTimeMs: number;
  errors: Array<{
    itemIndex: number;
    batchNumber: number;
    error: Error;
    retryAttempts: number;
  }>;
  skippedItems: number[];
}

/**
 * Item processing status enumeration
 *
 * @enum ItemStatus
 * @private
 */
enum ItemStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  RETRYING = 'retrying',
}

/**
 * Enterprise Batch Processor Class
 *
 * High-performance batch processing engine for handling large-scale bulk operations.
 * Supports concurrent batch processing with intelligent backpressure management,
 * advanced error recovery strategies, and real-time progress tracking.
 *
 * @class BatchProcessor
 * @typeParam TInput - Type of items to process
 * @typeParam TOutput - Type of processed output items (defaults to TInput)
 *
 * @example
 * ```typescript
 * const processor = new BatchProcessor<Product, ProcessedProduct>({
 *   batchSize: 500,
 *   concurrency: 10,
 *   retryAttempts: 3,
 *   errorStrategy: 'collect-errors',
 *   onProgress: (progress) => {
 *     console.log(`${progress.percentComplete.toFixed(1)}% complete - ${progress.processedItems}/${progress.totalItems}`);
 *   },
 * });
 *
 * const result = await processor.process(
 *   largeProductList,
 *   async (batch) => {
 *     return await api.enrichProductData(batch);
 *   },
 *   abortController.signal
 * );
 *
 * console.log(`Success: ${result.successCount}, Failed: ${result.failureCount}`);
 * if (result.errors.length > 0) {
 *   console.error('Errors:', result.errors);
 * }
 * ```
 */
export class BatchProcessor<TInput, TOutput = TInput> {
  private batchSize: number;
  private concurrency: number;
  private retryAttempts: number;
  private errorStrategy: 'stop-on-error' | 'continue-on-error' | 'collect-errors';
  private backpressureThreshold: number;
  private rateLimitPerSecond: number;
  private onProgress?: (progress: BatchProgress) => void;
  private rateLimitInterval?: number;

  constructor(options: BatchProcessorOptions = {}) {
    this.batchSize = options.batchSize || 100;
    this.concurrency = options.concurrency || 4;
    this.retryAttempts = options.retryAttempts || 3;
    this.errorStrategy = options.errorStrategy || 'continue-on-error';
    this.backpressureThreshold = options.backpressureThreshold || this.concurrency * 2;
    this.rateLimitPerSecond = options.rateLimitPerSecond || 0;
    this.onProgress = options.onProgress;

    if (this.rateLimitPerSecond > 0) {
      this.rateLimitInterval = Math.floor(1000 / this.rateLimitPerSecond);
    }

    logger.info('BatchProcessor initialized', {
      batchSize: this.batchSize,
      concurrency: this.concurrency,
      retryAttempts: this.retryAttempts,
      errorStrategy: this.errorStrategy,
      rateLimitPerSecond: this.rateLimitPerSecond,
    });
  }

  /**
   * Process items in batches with concurrency control and error handling
   *
   * Main entry point for batch processing. Divides items into batches and processes
   * them concurrently with intelligent backpressure management.
   *
   * @param items - Array of items to process
   * @param processor - Async function that processes a batch and returns results
   * @param abortSignal - Optional AbortSignal for cancellation support
   * @returns Promise resolving to BatchResult with detailed statistics
   * @throws Error if errorStrategy is 'stop-on-error' and any batch fails
   *
   * @example
   * ```typescript
   * const items = [item1, item2, item3, ...];
   * const result = await processor.process(
   *   items,
   *   async (batch) => {
   *     const results = await api.processInBulk(batch);
   *     return results;
   *   }
   * );
   * ```
   */
  async process(
    items: TInput[],
    processor: (batch: TInput[]) => Promise<TOutput[]>,
    abortSignal?: AbortSignal
  ): Promise<BatchResult<TOutput>> {
    if (items.length === 0) {
      return {
        results: [],
        successCount: 0,
        failureCount: 0,
        skipCount: 0,
        totalProcessingTimeMs: 0,
        errors: [],
        skippedItems: [],
      };
    }

    const startTime = Date.now();
    const totalBatches = Math.ceil(items.length / this.batchSize);
    const results: TOutput[] = [];
    const errors: BatchResult<TOutput>['errors'] = [];
    const itemStatuses: ItemStatus[] = new Array(items.length).fill(ItemStatus.SKIPPED);
    let processedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    logger.info(`Starting batch processing`, {
      totalItems: items.length,
      totalBatches,
      batchSize: this.batchSize,
    });

    const queue: Promise<void>[] = [];
    let lastRateLimitTime = Date.now();

    for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
      // Check for abort signal
      if (abortSignal?.aborted) {
        logger.info('Batch processing aborted');
        skippedCount += items.length - processedCount;
        break;
      }

      // Apply backpressure: wait if too many concurrent operations
      if (queue.length >= this.backpressureThreshold) {
        await Promise.race(queue);
        queue.splice(
          queue.findIndex((p) => p === queue[0]),
          1
        );
      }

      // Apply rate limiting
      if (this.rateLimitInterval) {
        const elapsed = Date.now() - lastRateLimitTime;
        if (elapsed < this.rateLimitInterval) {
          await new Promise((resolve) => setTimeout(resolve, this.rateLimitInterval! - elapsed));
        }
        lastRateLimitTime = Date.now();
      }

      const batchStart = batchNumber * this.batchSize;
      const batchEnd = Math.min(batchStart + this.batchSize, items.length);
      const batch = items.slice(batchStart, batchEnd);

      const batchPromise = (async () => {
        try {
          const batchResults = await this.processBatchWithRetry(
            batch,
            processor,
            batchNumber + 1,
            batchStart
          );

          results.push(...batchResults);
          processedCount += batch.length;

          for (let i = 0; i < batch.length; i++) {
            itemStatuses[batchStart + i] = ItemStatus.SUCCESS;
          }

          this.reportProgress({
            totalItems: items.length,
            processedItems: processedCount,
            failedItems: failedCount,
            skippedItems: skippedCount,
            percentComplete: (processedCount / items.length) * 100,
            currentBatch: batchNumber + 1,
            totalBatches,
            estimatedTimeRemainingMs: this.estimateTimeRemaining(
              startTime,
              processedCount,
              items.length
            ),
            elapsedTimeMs: Date.now() - startTime,
          });
        } catch (error) {
          failedCount += batch.length;

          if (this.errorStrategy === 'stop-on-error') {
            logger.error(`Stopping batch processing due to error in batch ${batchNumber + 1}`, {
              error,
            });
            throw error;
          }

          if (this.errorStrategy === 'collect-errors' || this.errorStrategy === 'continue-on-error') {
            const err = error instanceof Error ? error : new Error(String(error));

            errors.push({
              itemIndex: batchStart,
              batchNumber: batchNumber + 1,
              error: err,
              retryAttempts: this.retryAttempts,
            });

            logger.warn(`Error processing batch ${batchNumber + 1}`, { error });

            if (this.errorStrategy === 'continue-on-error') {
              skippedCount += batch.length;
              for (let i = 0; i < batch.length; i++) {
                itemStatuses[batchStart + i] = ItemStatus.SKIPPED;
              }
            }
          }

          this.reportProgress({
            totalItems: items.length,
            processedItems: processedCount,
            failedItems: failedCount,
            skippedItems: skippedCount,
            percentComplete: (processedCount / items.length) * 100,
            currentBatch: batchNumber + 1,
            totalBatches,
            estimatedTimeRemainingMs: this.estimateTimeRemaining(
              startTime,
              processedCount,
              items.length
            ),
            elapsedTimeMs: Date.now() - startTime,
          });
        }
      })();

      queue.push(batchPromise);
    }

    // Wait for remaining batches
    await Promise.all(queue);

    const totalProcessingTimeMs = Date.now() - startTime;
    const skippedItems = itemStatuses
      .map((status, index) => (status === ItemStatus.SKIPPED ? index : -1))
      .filter((index) => index !== -1);

    const result: BatchResult<TOutput> = {
      results,
      successCount: processedCount,
      failureCount: failedCount,
      skipCount: skippedCount,
      totalProcessingTimeMs,
      errors,
      skippedItems,
    };

    logger.info('Batch processing completed', {
      totalItems: items.length,
      successCount: result.successCount,
      failureCount: result.failureCount,
      skipCount: result.skipCount,
      totalProcessingTimeMs,
      averageTimePerBatch: totalProcessingTimeMs / totalBatches,
    });

    return result;
  }

  /**
   * Process single batch with exponential backoff retry logic
   *
   * @private
   * @param batch - Batch of items to process
   * @param processor - Function to process the batch
   * @param batchNumber - Current batch number for logging
   * @param batchStartIndex - Starting index of batch in original array
   * @returns Array of processed results
   * @throws Error if all retry attempts fail
   */
  private async processBatchWithRetry(
    batch: TInput[],
    processor: (batch: TInput[]) => Promise<TOutput[]>,
    batchNumber: number,
    batchStartIndex: number
  ): Promise<TOutput[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const results = await processor(batch);
        logger.debug(`Processed batch ${batchNumber}`, {
          itemsCount: batch.length,
          resultsCount: results.length,
          attempt: attempt + 1,
        });
        return results;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.retryAttempts) {
          const backoffMs = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn(`Batch ${batchNumber} failed, retrying in ${backoffMs}ms`, {
            attempt: attempt + 1,
            maxAttempts: this.retryAttempts + 1,
            error,
          });
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError || new Error('Batch processing failed');
  }

  /**
   * Report and log progress callback
   *
   * @private
   * @param progress - Current progress information
   */
  private reportProgress(progress: BatchProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }

    if (progress.percentComplete % 25 === 0) {
      logger.info(`Batch processing progress: ${progress.percentComplete.toFixed(1)}%`, {
        processedItems: progress.processedItems,
        totalItems: progress.totalItems,
        estimatedTimeRemainingMs: progress.estimatedTimeRemainingMs,
      });
    }
  }

  /**
   * Estimate remaining processing time based on current progress
   *
   * @private
   * @param startTime - Processing start timestamp (milliseconds)
   * @param processedItems - Number of items processed so far
   * @param totalItems - Total items to process
   * @returns Estimated remaining time in milliseconds
   */
  private estimateTimeRemaining(
    startTime: number,
    processedItems: number,
    totalItems: number
  ): number {
    if (processedItems === 0) return 0;

    const elapsedMs = Date.now() - startTime;
    const avgTimePerItem = elapsedMs / processedItems;
    const remainingItems = totalItems - processedItems;

    return Math.round(avgTimePerItem * remainingItems);
  }
}

export default BatchProcessor;
