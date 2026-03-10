import { describe, expect, it } from '@jest/globals';

import { InnproIofParser } from '../../src/infrastructure/iof/InnproIofParser';

describe('InnproIofParser', () => {
  it('keeps stockQuantity undefined when XML delta omits stock field', () => {
    const parser = new InnproIofParser();
    const xml = `
      <products>
        <product>
          <sku>SKU-1</sku>
          <name>Test</name>
          <price>19.9</price>
          <currency>RON</currency>
        </product>
      </products>
    `;

    const products = parser.parseProducts(xml);

    expect(products).toHaveLength(1);
    expect(products[0]?.supplierSku).toBe('SKU-1');
    expect(products[0]?.stockQuantity).toBeUndefined();
  });

  it('keeps stockQuantity undefined when delimited delta has empty stock column', () => {
    const parser = new InnproIofParser();
    const csv = `sku;name;price;stock;currency\nSKU-2;Test 2;22.5;;RON`;

    const products = parser.parseProducts(csv);

    expect(products).toHaveLength(1);
    expect(products[0]?.supplierSku).toBe('SKU-2');
    expect(products[0]?.stockQuantity).toBeUndefined();
  });
});
