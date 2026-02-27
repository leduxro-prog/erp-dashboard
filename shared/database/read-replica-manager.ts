import { DataSource } from 'typeorm';

import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('read-replica-manager');

let readReplicaDataSource: DataSource | null = null;

export function setReadReplicaDataSource(dataSource?: DataSource): void {
  if (!dataSource) {
    readReplicaDataSource = null;
    return;
  }

  readReplicaDataSource = dataSource;
}

export function getReadDataSource(primaryDataSource: DataSource): DataSource {
  if (!readReplicaDataSource || !readReplicaDataSource.isInitialized) {
    return primaryDataSource;
  }

  return readReplicaDataSource;
}

export function hasReadReplicaDataSource(): boolean {
  return Boolean(readReplicaDataSource && readReplicaDataSource.isInitialized);
}

export async function destroyReadReplicaDataSource(): Promise<void> {
  if (!readReplicaDataSource || !readReplicaDataSource.isInitialized) {
    return;
  }

  try {
    await readReplicaDataSource.destroy();
  } catch (error) {
    logger.warn('Failed to destroy read replica data source', { error });
  } finally {
    readReplicaDataSource = null;
  }
}
