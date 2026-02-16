/**
 * Stream Processor for Large Data Exports/Imports
 * Handles streaming of 100K+ items to CSV/JSON formats and importing from streams
 * Memory-efficient with backpressure handling and progress tracking
 *
 * @module shared/utils/stream-processor
 */

import { Transform, Writable, Readable, TransformCallback } from 'stream';
import { SelectQueryBuilder, DataSource, ObjectLiteral } from 'typeorm';
import { createModuleLogger } from './logger';

const logger = createModuleLogger('stream-processor');

/**
 * CSV export options
 */
export interface CSVExportOptions {
  headers?: string[];
  delimiter?: string;
  batchSize?: number;
  onProgress?: (processed: number, total?: number) => void;
}

/**
 * JSON export options
 */
export interface JSONExportOptions {
  batchSize?: number;
  pretty?: boolean;
  onProgress?: (processed: number, total?: number) => void;
}

/**
 * CSV import options
 */
export interface CSVImportOptions {
  batchSize?: number;
  headers?: string[];
  skipHeader?: boolean;
  onProgress?: (processed: number) => void;
}

/**
 * Stream processor for large data operations
 *
 * Features:
 * - Stream database queries to CSV/JSON without loading all data into memory
 * - Import CSV/JSON data in batches
 * - Automatic backpressure handling
 * - Progress tracking
 * - Transform functions for data mapping
 * - Memory-efficient for 100K+ items
 *
 * @example
 * ```typescript
 * const processor = new StreamProcessor(dataSource);
 *
 * // Export 100K products to CSV
 * const readable = fs.createReadStream('products.csv');
 * await processor.streamToCSV(
 *   repo.createQueryBuilder('p'),
 *   (item) => ({ id: item.id, name: item.name }),
 *   readable,
 *   { batchSize: 1000 }
 * );
 * ```
 */
export class StreamProcessor {
  private dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    logger.info('StreamProcessor initialized');
  }

  /**
   * Stream database query to CSV format
   * Writes results directly to writable stream without loading all into memory
   *
   * @param queryBuilder - TypeORM SelectQueryBuilder
   * @param transform - Function to transform each item before CSV serialization
   * @param writable - Destination writable stream
   * @param options - Export options
   *
   * @example
   * ```typescript
   * const qb = repo.createQueryBuilder('product');
   * const output = fs.createWriteStream('products.csv');
   *
   * await processor.streamToCSV(
   *   qb,
   *   (product) => ({
   *     id: product.id,
   *     name: product.name,
   *     price: product.price,
   *   }),
   *   output,
   *   { batchSize: 1000, delimiter: ',' }
   * );
   * ```
   */
  async streamToCSV<T extends ObjectLiteral, R extends Record<string, any>>(
    queryBuilder: SelectQueryBuilder<T>,
    transform: (item: T) => R,
    writable: Writable,
    options: CSVExportOptions = {}
  ): Promise<void> {
    const {
      headers: customHeaders,
      delimiter = ',',
      batchSize = 1000,
      onProgress,
    } = options;

    let totalProcessed = 0;
    let headerWritten = false;
    let headers: string[] = [];

    return new Promise((resolve, reject) => {
      // Create transform stream
      const csvTransform = new Transform({
        transform(chunk: T, encoding: BufferEncoding, callback: TransformCallback) {
          try {
            const transformed = transform(chunk);

            // First item: write headers
            if (!headerWritten) {
              headers = customHeaders || Object.keys(transformed);
              const headerLine = headers.join(delimiter);
              this.push(`${headerLine}\n`);
              headerWritten = true;
            }

            // Write data row
            const values = headers.map((header) => {
              const value = transformed[header];
              if (value === null || value === undefined) {
                return '';
              }
              // Escape quotes and wrap in quotes if contains delimiter or newline
              const stringValue = String(value);
              if (stringValue.includes(delimiter) || stringValue.includes('\n') || stringValue.includes('"')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            });

            this.push(`${values.join(delimiter)}\n`);
            totalProcessed++;

            if (onProgress && totalProcessed % (batchSize || 1000) === 0) {
              onProgress(totalProcessed);
            }

            callback();
          } catch (error) {
            callback(error as Error);
          }
        },
      });

      // Stream from database query
      this.streamQueryToObjects(queryBuilder, batchSize)
        .pipe(csvTransform)
        .pipe(writable)
        .on('finish', () => {
          logger.info(`CSV export completed`, { totalProcessed });
          resolve();
        })
        .on('error', (error) => {
          logger.error(`CSV export failed`, { error });
          reject(error);
        });

      csvTransform.on('error', (error) => {
        logger.error(`CSV transform error`, { error });
        reject(error);
      });
    });
  }

  /**
   * Stream database query to JSON Lines format (one JSON object per line)
   *
   * @param queryBuilder - TypeORM SelectQueryBuilder
   * @param transform - Function to transform each item
   * @param writable - Destination writable stream
   * @param options - Export options
   *
   * @example
   * ```typescript
   * const qb = repo.createQueryBuilder('product');
   * const output = fs.createWriteStream('products.jsonl');
   *
   * await processor.streamToJSON(
   *   qb,
   *   (product) => ({
   *     id: product.id,
   *     name: product.name,
   *   }),
   *   output,
   *   { batchSize: 2000 }
   * );
   * ```
   */
  async streamToJSON<T extends ObjectLiteral, R extends Record<string, any>>(
    queryBuilder: SelectQueryBuilder<T>,
    transform: (item: T) => R,
    writable: Writable,
    options: JSONExportOptions = {}
  ): Promise<void> {
    const { batchSize = 1000, pretty = false, onProgress } = options;

    let totalProcessed = 0;
    let firstItem = true;

    return new Promise((resolve, reject) => {
      const jsonTransform = new Transform({
        transform(chunk: T, encoding: BufferEncoding, callback: TransformCallback) {
          try {
            const transformed = transform(chunk);

            // Write array start
            if (firstItem) {
              this.push('[\n');
              firstItem = false;
            } else {
              this.push(',\n');
            }

            // Write JSON object
            if (pretty) {
              this.push(`  ${JSON.stringify(transformed, null, 2)}`);
            } else {
              this.push(JSON.stringify(transformed));
            }

            totalProcessed++;

            if (onProgress && totalProcessed % (batchSize || 1000) === 0) {
              onProgress(totalProcessed);
            }

            callback();
          } catch (error) {
            callback(error as Error);
          }
        },

        flush(callback: TransformCallback) {
          if (!firstItem) {
            this.push('\n]\n');
          } else {
            this.push('[]\n');
          }
          callback();
        },
      });

      this.streamQueryToObjects(queryBuilder, batchSize)
        .pipe(jsonTransform)
        .pipe(writable)
        .on('finish', () => {
          logger.info(`JSON export completed`, { totalProcessed });
          resolve();
        })
        .on('error', (error) => {
          logger.error(`JSON export failed`, { error });
          reject(error);
        });

      jsonTransform.on('error', (error) => {
        logger.error(`JSON transform error`, { error });
        reject(error);
      });
    });
  }

  /**
   * Import CSV data in batches
   *
   * @param readable - Source readable stream with CSV data
   * @param transform - Function to transform CSV row to entity
   * @param options - Import options
   * @returns Async generator yielding batches of items
   *
   * @example
   * ```typescript
   * const readable = fs.createReadStream('products.csv');
   *
   * for await (const batch of processor.streamFromCSV(
   *   readable,
   *   (row) => ({
   *     name: row[0],
   *     sku: row[1],
   *     price: parseFloat(row[2]),
   *   })
   * )) {
   *   await repo.insert(batch);
   * }
   * ```
   */
  async *streamFromCSV<T extends Record<string, any>>(
    readable: Readable,
    transform: (row: string[]) => T,
    options: CSVImportOptions = {}
  ): AsyncGenerator<T[], void, unknown> {
    const { batchSize = 500, headers: customHeaders, skipHeader = true, onProgress } = options;

    let batch: T[] = [];
    let lineNumber = 0;
    let headers: string[] = [];
    let headersParsed = false;

    return new Promise((resolve, reject) => {
      const csvTransform = new Transform({
        transform(chunk: string, encoding: BufferEncoding, callback: TransformCallback) {
          try {
            const lines = chunk.toString().split('\n');

            for (const line of lines) {
              if (!line.trim()) continue;

              lineNumber++;

              // Parse headers from first line if needed
              if (!headersParsed && skipHeader && lineNumber === 1) {
                if (customHeaders) {
                  headers = customHeaders;
                } else {
                  headers = line.split(',').map((h) => h.trim());
                }
                headersParsed = true;
                continue;
              }

              if (!headersParsed) {
                headersParsed = true;
              }

              // Parse CSV row
              const row = this.parseCSVLine(line);
              const transformed = transform(row);

              batch.push(transformed);

              if (onProgress) {
                onProgress(lineNumber);
              }

              // Yield batch when full
              if (batch.length >= batchSize) {
                this.push(JSON.stringify({ _batch: batch }));
                batch = [];
              }
            }

            callback();
          } catch (error) {
            callback(error as Error);
          }
        },

        flush(callback: TransformCallback) {
          if (batch.length > 0) {
            this.push(JSON.stringify({ _batch: batch }));
          }
          callback();
        },
      } as any);

      readable
        .pipe(csvTransform)
        .on('data', (chunk) => {
          try {
            const data = JSON.parse(chunk);
            if (data._batch) {
              resolve(data._batch);
            }
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          logger.error(`CSV import stream error`, { error });
          reject(error);
        });

      csvTransform.on('error', (error) => {
        logger.error(`CSV transform error`, { error });
        reject(error);
      });
    });
  }

  /**
   * Stream query results through object readable stream
   */
  private streamQueryToObjects<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    batchSize: number = 1000
  ): Readable {
    let skip = 0;
    let exhausted = false;

    return new Readable({
      objectMode: true,
      async read() {
        try {
          if (exhausted) {
            this.push(null);
            return;
          }

          const clonedQuery = queryBuilder.clone();
          const results = await clonedQuery
            .take(batchSize)
            .skip(skip)
            .getMany();

          if (results.length === 0) {
            exhausted = true;
            this.push(null);
            return;
          }

          for (const result of results) {
            this.push(result);
          }

          skip += batchSize;
        } catch (error) {
          this.destroy(error as Error);
        }
      },
    });
  }

  /**
   * Parse CSV line handling quoted fields
   */
  private parseCSVLine(line: string, delimiter: string = ','): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }
}

export default StreamProcessor;
