import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateSmartBillTables1739580000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create smartbill_invoices table
        await queryRunner.createTable(new Table({
            name: "smartbill_invoices",
            columns: [
                { name: "id", type: "integer", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                { name: "orderId", type: "integer" },
                { name: "smartBillId", type: "varchar", isNullable: true },
                { name: "invoiceNumber", type: "varchar", isNullable: true },
                { name: "series", type: "varchar", default: "'FL'" },
                { name: "customerName", type: "varchar" },
                { name: "customerVat", type: "varchar" },
                { name: "items", type: "jsonb", isNullable: true },
                { name: "totalWithoutVat", type: "decimal", precision: 10, scale: 2 },
                { name: "vatAmount", type: "decimal", precision: 10, scale: 2 },
                { name: "totalWithVat", type: "decimal", precision: 10, scale: 2 },
                { name: "currency", type: "varchar", default: "'RON'" },
                { name: "status", type: "varchar", default: "'draft'" },
                { name: "issueDate", type: "timestamp" },
                { name: "dueDate", type: "timestamp" },
                { name: "paidAmount", type: "decimal", precision: 10, scale: 2, default: 0 },
                { name: "paymentDate", type: "timestamp", isNullable: true },
                { name: "createdAt", type: "timestamp", default: "now()" },
                { name: "updatedAt", type: "timestamp", default: "now()" }
            ]
        }), true);

        // Create indices
        await queryRunner.createIndex("smartbill_invoices", new TableIndex({
            name: "idx_smartbill_invoices_order_id",
            columnNames: ["orderId"]
        }));
        await queryRunner.createIndex("smartbill_invoices", new TableIndex({
            name: "idx_smartbill_invoices_smartbill_id",
            columnNames: ["smartBillId"]
        }));
        await queryRunner.createIndex("smartbill_invoices", new TableIndex({
            name: "idx_smartbill_invoices_status",
            columnNames: ["status"]
        }));

        // Create smartbill_proformas table
        await queryRunner.createTable(new Table({
            name: "smartbill_proformas",
            columns: [
                { name: "id", type: "integer", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                { name: "orderId", type: "integer" },
                { name: "smartBillId", type: "varchar", isNullable: true },
                { name: "proformaNumber", type: "varchar", isNullable: true },
                { name: "series", type: "varchar", default: "'PF'" },
                { name: "customerName", type: "varchar" },
                { name: "customerVat", type: "varchar" },
                { name: "items", type: "jsonb", isNullable: true },
                { name: "totalWithoutVat", type: "decimal", precision: 10, scale: 2 },
                { name: "vatAmount", type: "decimal", precision: 10, scale: 2 },
                { name: "totalWithVat", type: "decimal", precision: 10, scale: 2 },
                { name: "currency", type: "varchar", default: "'RON'" },
                { name: "status", type: "varchar", default: "'draft'" },
                { name: "issueDate", type: "timestamp" },
                { name: "dueDate", type: "timestamp" },
                { name: "createdAt", type: "timestamp", default: "now()" },
                { name: "updatedAt", type: "timestamp", default: "now()" }
            ]
        }), true);

        // Create indices
        await queryRunner.createIndex("smartbill_proformas", new TableIndex({
            name: "idx_smartbill_proformas_order_id",
            columnNames: ["orderId"]
        }));
        await queryRunner.createIndex("smartbill_proformas", new TableIndex({
            name: "idx_smartbill_proformas_smartbill_id",
            columnNames: ["smartBillId"]
        }));
        await queryRunner.createIndex("smartbill_proformas", new TableIndex({
            name: "idx_smartbill_proformas_status",
            columnNames: ["status"]
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("smartbill_proformas");
        await queryRunner.dropTable("smartbill_invoices");
    }
}
