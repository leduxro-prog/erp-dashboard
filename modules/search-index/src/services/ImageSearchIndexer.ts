type ImageAssetBatch = {
  items: unknown[];
  nextCursor: string | null;
};

type ImageSearchIndexerDependencies = {
  source: {
    fetchActiveAssetsBatch(cursor?: string | null): Promise<ImageAssetBatch>;
    fetchAssetsForProduct(productId: number): Promise<unknown[]>;
  };
  embedder: {
    embedFromUrl(url: string): Promise<unknown>;
  };
  writer: {
    upsertPoints(points: unknown[]): Promise<void>;
  };
  failures: {
    recordFailure(input: unknown): Promise<void>;
  };
  indexVersion: string;
  modelVersion: string;
};

export class ImageSearchIndexer {
  constructor(private readonly dependencies: ImageSearchIndexerDependencies) {}

  getStatus(): { status: 'disabled'; indexVersion: string; modelVersion: string } {
    return {
      status: 'disabled',
      indexVersion: this.dependencies.indexVersion,
      modelVersion: this.dependencies.modelVersion,
    };
  }

  async reindexAll(): Promise<{ status: 'not_configured'; indexed: 0 }> {
    await this.dependencies.source.fetchActiveAssetsBatch(null);
    return { status: 'not_configured', indexed: 0 };
  }

  async reindexProduct(productId: number): Promise<{ status: 'not_configured'; productId: number; indexed: 0 }> {
    await this.dependencies.source.fetchAssetsForProduct(productId);
    return { status: 'not_configured', productId, indexed: 0 };
  }
}
