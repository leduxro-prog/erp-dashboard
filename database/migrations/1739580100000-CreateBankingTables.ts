import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateBankingTables1739580100000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Bank Accounts
        await queryRunner.createTable(new Table({
            name: "bank_accounts",
            columns: [
                { name: "id", type: "integer", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                { name: "name", type: "varchar" },
                { name: "iban", type: "varchar", isUnique: true },
                { name: "bankName", type: "varchar" },
                { name: "currency", type: "varchar", default: "'RON'" },
                { name: "createdAt", type: "timestamp", default: "now()" },
                { name: "updatedAt", type: "timestamp", default: "now()" }
            ]
        }), true);

        // Bank Statement Imports
        await queryRunner.createTable(new Table({
            name: "bank_statement_imports",
            columns: [
                { name: "id", type: "integer", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                { name: "bankAccountId", type: "integer" },
                { name: "filename", type: "varchar" },
                { name: "fileHash", type: "varchar" }, // For deduplication
                { name: "status", type: "varchar", default: "'pending'" }, // pending, processed, failed
                { name: "importedBy", type: "varchar", isNullable: true },
                { name: "importDate", type: "timestamp", default: "now()" },
                { name: "periodStart", type: "date", isNullable: true },
                { name: "periodEnd", type: "date", isNullable: true },
                { name: "transactionCount", type: "integer", default: 0 }
            ]
        }), true);

        // Bank Transactions
        await queryRunner.createTable(new Table({
            name: "bank_transactions",
            columns: [
                { name: "id", type: "integer", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                { name: "importId", type: "integer" },
                { name: "bankAccountId", type: "integer" },
                { name: "date", type: "date" },
                { name: "amount", type: "decimal", precision: 10, scale: 2 },
                { name: "currency", type: "varchar" },
                { name: "description", type: "text" },
                { name: "reference", type: "varchar", isNullable: true },
                { name: "partnerName", type: "varchar", isNullable: true },
                { name: "partnerIban", type: "varchar", isNullable: true },
                { name: "fingerprint", type: "varchar" }, // Unique hash of date+amount+desc+ref to prevent dupes
                { name: "status", type: "varchar", default: "'unmatched'" }, // unmatched, matched, ignored
                { name: "createdAt", type: "timestamp", default: "now()" }
            ]
        }), true);

        // Payment Matches
        await queryRunner.createTable(new Table({
            name: "payment_matches",
            columns: [
                { name: "id", type: "integer", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
                { name: "transactionId", type: "integer" },
                { name: "matchType", type: "varchar" }, // invoice, proforma, order
                { name: "matchId", type: "integer" }, // ID of the matched entity
                { name: "amount", type: "decimal", precision: 10, scale: 2 },
                { name: "confidence", type: "decimal", precision: 5, scale: 2 }, // 0-100 score
                { name: "status", type: "varchar", default: "'suggested'" }, // suggested, confirmed, rejected
                { name: "matchedBy", type: "varchar", default: "'system'" },
                { name: "matchedAt", type: "timestamp", default: "now()" }
            ]
        }), true);

        // FKs
        await queryRunner.createForeignKey("bank_statement_imports", new TableForeignKey({
            columnNames: ["bankAccountId"],
            referencedColumnNames: ["id"],
            referencedTableName: "bank_accounts",
            onDelete: "CASCADE"
        }));

        await queryRunner.createForeignKey("bank_transactions", new TableForeignKey({
            columnNames: ["importId"],
            referencedColumnNames: ["id"],
            referencedTableName: "bank_statement_imports",
            onDelete: "CASCADE"
        }));

        await queryRunner.createForeignKey("bank_transactions", new TableForeignKey({
            columnNames: ["bankAccountId"],
            referencedColumnNames: ["id"],
            referencedTableName: "bank_accounts",
            onDelete: "CASCADE"
        }));

        await queryRunner.createForeignKey("payment_matches", new TableForeignKey({
            columnNames: ["transactionId"],
            referencedColumnNames: ["id"],
            referencedTableName: "bank_transactions",
            onDelete: "CASCADE"
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("payment_matches");
        await queryRunner.dropTable("bank_transactions");
        await queryRunner.dropTable("bank_statement_imports");
        await queryRunner.dropTable("bank_accounts");
    }
}
