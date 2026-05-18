import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableColumn } from "typeorm";

export class B2BEnterpriseFeatures1742070000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create b2b_sub_accounts table
        await queryRunner.createTable(new Table({
            name: "b2b_sub_accounts",
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "uuid"
                },
                {
                    name: "master_customer_id",
                    type: "integer"
                },
                {
                    name: "user_id",
                    type: "integer"
                },
                {
                    name: "permissions",
                    type: "jsonb",
                    default: "'{\"can_view_invoices\": false, \"can_place_orders\": true, \"order_approval_required\": true}'"
                },
                {
                    name: "monthly_limit",
                    type: "decimal",
                    precision: 12,
                    scale: 2,
                    default: 0
                },
                {
                    name: "current_month_spend",
                    type: "decimal",
                    precision: 12,
                    scale: 2,
                    default: 0
                },
                {
                    name: "created_at",
                    type: "timestamp",
                    default: "now()"
                },
                {
                    name: "updated_at",
                    type: "timestamp",
                    default: "now()"
                }
            ]
        }), true);

        // 2. Create b2b_projects table
        await queryRunner.createTable(new Table({
            name: "b2b_projects",
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "uuid"
                },
                {
                    name: "customer_id",
                    type: "integer"
                },
                {
                    name: "creator_id",
                    type: "integer"
                },
                {
                    name: "name",
                    type: "varchar",
                    length: "255"
                },
                {
                    name: "is_shared",
                    type: "boolean",
                    default: false
                },
                {
                    name: "metadata",
                    type: "jsonb",
                    default: "'{}'"
                },
                {
                    name: "created_at",
                    type: "timestamp",
                    default: "now()"
                },
                {
                    name: "updated_at",
                    type: "timestamp",
                    default: "now()"
                }
            ]
        }), true);

        // 3. Create b2b_project_items table
        await queryRunner.createTable(new Table({
            name: "b2b_project_items",
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: "uuid"
                },
                {
                    name: "project_id",
                    type: "uuid"
                },
                {
                    name: "product_id",
                    type: "integer"
                },
                {
                    name: "quantity",
                    type: "integer",
                    default: 1
                },
                {
                    name: "notes",
                    type: "text",
                    isNullable: true
                },
                {
                    name: "created_at",
                    type: "timestamp",
                    default: "now()"
                },
                {
                    name: "updated_at",
                    type: "timestamp",
                    default: "now()"
                }
            ]
        }), true);

        // 4. Update product_specifications table
        await queryRunner.addColumn("product_specifications", new TableColumn({
            name: "ies_file_url",
            type: "varchar",
            length: "500",
            isNullable: true
        }));

        // Add Foreign Keys
        await queryRunner.createForeignKey("b2b_sub_accounts", new TableForeignKey({
            columnNames: ["master_customer_id"],
            referencedColumnNames: ["id"],
            referencedTableName: "b2b_customers",
            onDelete: "CASCADE"
        }));

        await queryRunner.createForeignKey("b2b_sub_accounts", new TableForeignKey({
            columnNames: ["user_id"],
            referencedColumnNames: ["id"],
            referencedTableName: "users",
            onDelete: "CASCADE"
        }));

        await queryRunner.createForeignKey("b2b_projects", new TableForeignKey({
            columnNames: ["customer_id"],
            referencedColumnNames: ["id"],
            referencedTableName: "b2b_customers",
            onDelete: "CASCADE"
        }));

        await queryRunner.createForeignKey("b2b_project_items", new TableForeignKey({
            columnNames: ["project_id"],
            referencedColumnNames: ["id"],
            referencedTableName: "b2b_projects",
            onDelete: "CASCADE"
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey("b2b_project_items", "FK_project_id"); // TypeORM will naming it or I should be specific
        await queryRunner.dropColumn("product_specifications", "ies_file_url");
        await queryRunner.dropTable("b2b_project_items");
        await queryRunner.dropTable("b2b_projects");
        await queryRunner.dropTable("b2b_sub_accounts");
    }
}
