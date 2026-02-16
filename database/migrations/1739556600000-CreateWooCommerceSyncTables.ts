import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateWooCommerceSyncTables1739556600000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create wc_sync_items table
        await queryRunner.createTable(
            new Table({
                name: 'wc_sync_items',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                    },
                    {
                        name: 'productId',
                        type: 'uuid',
                    },
                    {
                        name: 'wooCommerceId',
                        type: 'integer',
                        isNullable: true,
                    },
                    {
                        name: 'syncType',
                        type: 'varchar',
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                    },
                    {
                        name: 'payload',
                        type: 'jsonb',
                    },
                    {
                        name: 'errorMessage',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'attempts',
                        type: 'integer',
                        default: 0,
                    },
                    {
                        name: 'maxAttempts',
                        type: 'integer',
                        default: 3,
                    },
                    {
                        name: 'lastAttempt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'completedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'now()',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'now()',
                    },
                ],
            }),
            true
        );

        await queryRunner.createIndices('wc_sync_items', [
            new TableIndex({
                name: 'IDX_WC_SYNC_ITEMS_STATUS_CREATED',
                columnNames: ['status', 'createdAt'],
            }),
            new TableIndex({
                name: 'IDX_WC_SYNC_ITEMS_PRODUCT_ID',
                columnNames: ['productId'],
            }),
            new TableIndex({
                name: 'IDX_WC_SYNC_ITEMS_TYPE_STATUS',
                columnNames: ['syncType', 'status'],
            }),
        ]);

        // 2. Create wc_sync_batches table
        await queryRunner.createTable(
            new Table({
                name: 'wc_sync_batches',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                    },
                    {
                        name: 'batchSize',
                        type: 'integer',
                        default: 100,
                    },
                    {
                        name: 'startedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'completedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'totalItems',
                        type: 'integer',
                        default: 0,
                    },
                    {
                        name: 'successCount',
                        type: 'integer',
                        default: 0,
                    },
                    {
                        name: 'failCount',
                        type: 'integer',
                        default: 0,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'now()',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'now()',
                    },
                ],
            }),
            true
        );

        await queryRunner.createIndex(
            'wc_sync_batches',
            new TableIndex({
                name: 'IDX_WC_SYNC_BATCHES_STATUS_CREATED',
                columnNames: ['status', 'createdAt'],
            })
        );

        // 3. Create wc_product_sync_mappings table
        await queryRunner.createTable(
            new Table({
                name: 'wc_product_sync_mappings',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                    },
                    {
                        name: 'internalProductId',
                        type: 'uuid',
                        isUnique: true,
                    },
                    {
                        name: 'wooCommerceProductId',
                        type: 'integer',
                        isUnique: true,
                    },
                    {
                        name: 'lastSynced',
                        type: 'timestamp',
                    },
                    {
                        name: 'syncStatus',
                        type: 'varchar',
                    },
                    {
                        name: 'errorMessage',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'now()',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'now()',
                    },
                ],
            }),
            true
        );

        await queryRunner.createIndices('wc_product_sync_mappings', [
            new TableIndex({
                name: 'IDX_WC_PRODUCT_SYNC_MAPPINGS_INTERNAL_PRODUCT_ID',
                columnNames: ['internalProductId'],
            }),
            new TableIndex({
                name: 'IDX_WC_PRODUCT_SYNC_MAPPINGS_WOO_PRODUCT_ID',
                columnNames: ['wooCommerceProductId'],
            }),
            new TableIndex({
                name: 'IDX_WC_PRODUCT_SYNC_MAPPINGS_STATUS',
                columnNames: ['syncStatus'],
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('wc_product_sync_mappings');
        await queryRunner.dropTable('wc_sync_batches');
        await queryRunner.dropTable('wc_sync_items');
    }
}
