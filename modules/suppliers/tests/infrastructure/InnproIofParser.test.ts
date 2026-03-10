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

  it('extracts image and key specifications from XML product block', () => {
    const parser = new InnproIofParser();
    const xml = `
      <products>
        <product>
          <sku>SKU-3</sku>
          <name>Spec Product</name>
          <price>199.90</price>
          <currency>RON</currency>
          <stock>7</stock>
          <image>https://cdn.innpro.test/SKU-3.jpg</image>
          <image_1>https://cdn.innpro.test/SKU-3-1.jpg</image_1>
          <image_2>https://cdn.innpro.test/SKU-3-2.jpg</image_2>
          <description>Detailed product description</description>
          <wattage>24</wattage>
          <ip_rating>IP65</ip_rating>
          <brand>Innpro</brand>
          <ean>5940000000001</ean>
        </product>
      </products>
    `;

    const products = parser.parseProducts(xml);

    expect(products).toHaveLength(1);
    expect(products[0]?.imageUrl).toBe('https://cdn.innpro.test/SKU-3.jpg');
    expect(products[0]?.images).toEqual([
      'https://cdn.innpro.test/SKU-3.jpg',
      'https://cdn.innpro.test/SKU-3-1.jpg',
      'https://cdn.innpro.test/SKU-3-2.jpg',
    ]);
    expect(products[0]?.specifications?.wattage).toBe(24);
    expect(products[0]?.specifications?.ipRating).toBe('IP65');
    expect(products[0]?.specifications?.customSpecs?.description).toBe('Detailed product description');
    expect(products[0]?.brand).toBe('Innpro');
    expect(products[0]?.ean).toBe('5940000000001');
  });
});
