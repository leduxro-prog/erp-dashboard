import { ImageSearchIndexer } from '../services/ImageSearchIndexer';

type RedisLikeConnection = {
  duplicate?: () => RedisLikeConnection;
};

export class ImageSearchIndexJob {
  constructor(
    private readonly redisConnection: RedisLikeConnection,
    private readonly indexer: ImageSearchIndexer,
  ) {}

  async enqueueFullReindex(_jobKey: string): Promise<void> {
    throw new Error(`Image search indexing is ${this.indexer.getStatus().status}`);
  }

  async enqueueProductReindex(_jobKey: string, _productId: number): Promise<void> {
    throw new Error(`Image search indexing is ${this.indexer.getStatus().status}`);
  }

  async close(): Promise<void> {
    // The module passes the shared event bus Redis client; this shell never owns that connection.
    void this.redisConnection;
  }
}
