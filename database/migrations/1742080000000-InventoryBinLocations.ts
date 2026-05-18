import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class InventoryBinLocations1742080000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn("stock_items", new TableColumn({
            name: "bin_location",
            type: "varchar",
            length: "50",
            isNullable: true
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("stock_items", "bin_location");
    }
}
