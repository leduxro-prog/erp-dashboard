import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class WarehouseLocationData1742100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns("warehouses", [
            new TableColumn({
                name: "city",
                type: "varchar",
                length: "100",
                isNullable: true
            }),
            new TableColumn({
                name: "region",
                type: "varchar",
                length: "100",
                isNullable: true
            }),
            new TableColumn({
                name: "postal_code",
                type: "varchar",
                length: "20",
                isNullable: true
            })
        ]);

        // Seed some location data for existing warehouses
        await queryRunner.query(`UPDATE warehouses SET city = 'Bucuresti', region = 'B' WHERE code = 'magazin'`);
        await queryRunner.query(`UPDATE warehouses SET city = 'Voluntari', region = 'IF' WHERE code = 'ddepozit'`);
        await queryRunner.query(`UPDATE warehouses SET city = 'Bucuresti', region = 'B' WHERE code = 'cantitativ'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("warehouses", "postal_code");
        await queryRunner.dropColumn("warehouses", "region");
        await queryRunner.dropColumn("warehouses", "city");
    }
}
