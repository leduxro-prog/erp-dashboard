import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerAddressesTable1739570000000 implements MigrationInterface {
  name = 'CreateCustomerAddressesTable1739570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS customer_addresses (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        label VARCHAR(100) NOT NULL,
        address TEXT NOT NULL,
        address_type VARCHAR(20) NOT NULL DEFAULT 'both',
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_customer_addresses_customer
          FOREIGN KEY (customer_id)
          REFERENCES b2b_customers(id)
          ON DELETE CASCADE,
        CONSTRAINT chk_address_type
          CHECK (address_type IN ('shipping', 'billing', 'both'))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_customer_addresses_customer_id
      ON customer_addresses (customer_id)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_customer_addresses_customer_label
      ON customer_addresses (customer_id, label)
    `);

    console.log('✅ customer_addresses table created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_customer_addresses_customer_label`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_customer_addresses_customer_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS customer_addresses`);
    console.log('✅ customer_addresses table dropped successfully');
  }
}
