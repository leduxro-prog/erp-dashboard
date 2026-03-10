import { describe, expect, it } from '@jest/globals';

import { StructuredDataGenerator } from '../../src/domain/services/StructuredDataGenerator';

describe('StructuredDataGenerator', () => {
  it('uses image gallery array for Product schema when available', () => {
    const generator = new StructuredDataGenerator('https://ledux.ro');

    const schema = generator.generateProduct({
      id: 'prod-1',
      name: 'Produs Test',
      description: 'Descriere',
      price: 199,
      imageUrl: 'https://ledux.ro/images/primary.jpg',
      imageUrls: [
        'https://ledux.ro/images/primary.jpg',
        'https://ledux.ro/images/gallery-2.jpg',
      ],
    });

    expect(schema.image).toEqual([
      'https://ledux.ro/images/primary.jpg',
      'https://ledux.ro/images/gallery-2.jpg',
    ]);
  });
});
