/**
 * GenerateProductSeo Use Case Tests
 * Tests meta tag generation and structured data creation
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GenerateProductSeo, GenerateProductSeoInput } from '../../src/application/use-cases/GenerateProductSeo';
import { ProductNotFoundError } from '../../src/domain/errors/seo.errors';

describe('GenerateProductSeo Use Case', () => {
  let useCase: GenerateProductSeo;
  let mockProductPort: any;
  let mockMetadataRepository: any;
  let mockStructuredDataRepository: any;
  let mockMetaTagGenerator: any;
  let mockSlugGenerator: any;
  let mockStructuredDataGenerator: any;
  let mockScoreCalculator: any;
  let mockEventBus: any;
  let mockLogger: any;

  beforeEach(() => {
    mockProductPort = { getProduct: jest.fn() };
    mockMetadataRepository = { save: jest.fn() };
    mockStructuredDataRepository = { save: jest.fn() };
    mockMetaTagGenerator = { generateForProduct: jest.fn() };
    mockSlugGenerator = { generate: jest.fn() };
    mockStructuredDataGenerator = { generateProduct: jest.fn() };
    mockScoreCalculator = { calculate: jest.fn() };
    mockEventBus = { publish: jest.fn() };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    useCase = new GenerateProductSeo(
      mockProductPort,
      mockMetadataRepository,
      mockStructuredDataRepository,
      mockMetaTagGenerator,
      mockSlugGenerator,
      mockStructuredDataGenerator,
      mockScoreCalculator,
      mockEventBus,
      mockLogger
    );
  });

  describe('Happy Path - SEO Generation', () => {
    it('should generate SEO metadata successfully', async () => {
      const product = {
        id: 'prod-001',
        name: 'LED Ceiling Light 50W',
        category: 'Lighting',
        description: 'Modern LED ceiling light with 50W power',
        price: 299.99,
        sku: 'LED-50W-001',
        features: ['Energy efficient', 'Dimmable', '10 year warranty'],
        image: 'https://example.com/led-light.jpg',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-001',
        locale: 'ro',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'LED Ceiling Light 50W | Ledux',
        description: 'Modern LED ceiling light with 50W power. Energy efficient & dimmable.',
        focusKeyword: 'LED ceiling light',
      });
      mockSlugGenerator.generate.mockReturnValue('led-ceiling-light-50w');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({ '@type': 'Product' });
      mockScoreCalculator.calculate.mockReturnValue(85);
      mockMetadataRepository.save.mockResolvedValue({
        id: 'meta-prod-001-ro',
        seoScore: 85,
      });
      mockStructuredDataRepository.save.mockResolvedValue({
        id: 'sd-prod-001-ro',
      });

      const result = await useCase.execute(input);

      expect(result.metadata.id).toBe('meta-prod-001-ro');
      expect(result.score).toBe(85);
      expect(result.focusKeyword).toBe('LED ceiling light');
      expect(mockEventBus.publish).toHaveBeenCalledWith('seo.metadata_generated', expect.any(Object));
    });

    it('should support Romanian locale', async () => {
      const product = {
        id: 'prod-002',
        name: 'Lampa LED Tavan',
        description: 'Lampa LED moderna',
        price: 250,
        sku: 'LED-RO-001',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-002',
        locale: 'ro',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Lampa LED Tavan | Ledux',
        description: 'Lampa LED moderna de tavan.',
        focusKeyword: 'lampa LED',
      });
      mockSlugGenerator.generate.mockReturnValue('lampa-led-tavan');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({});
      mockScoreCalculator.calculate.mockReturnValue(80);
      mockMetadataRepository.save.mockResolvedValue({});
      mockStructuredDataRepository.save.mockResolvedValue({});

      const result = await useCase.execute(input);

      expect(result.focusKeyword).toBe('lampa LED');
    });

    it('should support English locale', async () => {
      const product = {
        id: 'prod-003',
        name: 'Smart LED Bulb',
        description: 'WiFi enabled smart LED bulb',
        price: 45.99,
        sku: 'LED-SMART-001',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-003',
        locale: 'en',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Smart LED Bulb | Ledux',
        description: 'WiFi enabled smart LED bulb with app control.',
        focusKeyword: 'smart LED bulb',
      });
      mockSlugGenerator.generate.mockReturnValue('smart-led-bulb');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({});
      mockScoreCalculator.calculate.mockReturnValue(90);
      mockMetadataRepository.save.mockResolvedValue({});
      mockStructuredDataRepository.save.mockResolvedValue({});

      const result = await useCase.execute(input);

      expect(result.focusKeyword).toBe('smart LED bulb');
    });

    it('should generate slug with Romanian diacritics handling', async () => {
      const product = {
        id: 'prod-004',
        name: 'Lampă LED cu Suport Răsucit',
        description: 'Descriere cu caractere speciale: ă, ș, ț',
        price: 199.99,
        sku: 'LED-DIAC-001',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-004',
        locale: 'ro',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Lampă LED cu Suport',
        description: 'Lampă LED cu suport.',
        focusKeyword: 'lampă LED',
      });
      mockSlugGenerator.generate.mockReturnValue('lampa-led-cu-suport-rasucit');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({});
      mockScoreCalculator.calculate.mockReturnValue(75);
      mockMetadataRepository.save.mockResolvedValue({});
      mockStructuredDataRepository.save.mockResolvedValue({});

      const result = await useCase.execute(input);

      expect(mockSlugGenerator.generate).toHaveBeenCalledWith('Lampă LED cu Suport Răsucit');
    });

    it('should generate canonical URL', async () => {
      const product = {
        id: 'prod-005',
        name: 'Standard LED Light',
        description: 'Standard light',
        price: 100,
        sku: 'LED-STD-001',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-005',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Standard LED Light',
        description: 'Standard light.',
        focusKeyword: 'LED light',
      });
      mockSlugGenerator.generate.mockReturnValue('standard-led-light');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({});
      mockScoreCalculator.calculate.mockReturnValue(80);
      mockMetadataRepository.save.mockResolvedValue({
        canonicalUrl: 'https://ledux.ro/products/standard-led-light',
      });
      mockStructuredDataRepository.save.mockResolvedValue({});

      const result = await useCase.execute(input);

      const metadataCall = mockMetadataRepository.save.mock.calls[0][0];
      expect(metadataCall.canonicalUrl).toContain('https://ledux.ro/products/');
    });

    it('should calculate SEO score', async () => {
      const product = {
        id: 'prod-006',
        name: 'Premium LED',
        description: 'Premium light product',
        price: 500,
        sku: 'LED-PREM-001',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-006',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Premium LED Light | Ledux',
        description: 'Premium LED light with excellent features.',
        focusKeyword: 'premium LED',
      });
      mockSlugGenerator.generate.mockReturnValue('premium-led');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({});
      mockScoreCalculator.calculate.mockReturnValue(92);
      mockMetadataRepository.save.mockResolvedValue({});
      mockStructuredDataRepository.save.mockResolvedValue({});

      const result = await useCase.execute(input);

      expect(result.score).toBe(92);
      expect(mockScoreCalculator.calculate).toHaveBeenCalled();
    });
  });

  describe('Error Cases', () => {
    it('should throw ProductNotFoundError when product does not exist', async () => {
      const input: GenerateProductSeoInput = {
        productId: 'prod-nonexistent',
      };

      mockProductPort.getProduct.mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toThrow(ProductNotFoundError);
      expect(mockMetadataRepository.save).not.toHaveBeenCalled();
    });

    it('should handle missing optional product fields', async () => {
      const product = {
        id: 'prod-007',
        name: 'Minimal Product',
        sku: 'MIN-001',
        // Missing: category, description, price, features, image
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-007',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Minimal Product',
        description: 'Product description.',
        focusKeyword: 'product',
      });
      mockSlugGenerator.generate.mockReturnValue('minimal-product');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({});
      mockScoreCalculator.calculate.mockReturnValue(50);
      mockMetadataRepository.save.mockResolvedValue({});
      mockStructuredDataRepository.save.mockResolvedValue({});

      const result = await useCase.execute(input);

      expect(result.metadata).toBeDefined();
    });
  });

  describe('Meta Tag Generation', () => {
    it('should generate title within recommended length', async () => {
      const product = {
        id: 'prod-008',
        name: 'Product with Long Name',
        description: 'Description',
        price: 100,
        sku: 'LONG-001',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-008',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Product with Long Name | Ledux',
        description: 'Description of product.',
        focusKeyword: 'product',
      });
      mockSlugGenerator.generate.mockReturnValue('product-with-long-name');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({});
      mockScoreCalculator.calculate.mockReturnValue(85);
      mockMetadataRepository.save.mockResolvedValue({});
      mockStructuredDataRepository.save.mockResolvedValue({});

      const result = await useCase.execute(input);

      const title = mockScoreCalculator.calculate.mock.calls[0][0].metaTitle;
      expect(title.length).toBeLessThanOrEqual(60);
    });

    it('should generate description within recommended length', async () => {
      const product = {
        id: 'prod-009',
        name: 'Test Product',
        description: 'Test description',
        price: 150,
        sku: 'TEST-001',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-009',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Test Product',
        description:
          'Test description of a product that is comprehensive and provides value to search engine users.',
        focusKeyword: 'test product',
      });
      mockSlugGenerator.generate.mockReturnValue('test-product');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({});
      mockScoreCalculator.calculate.mockReturnValue(80);
      mockMetadataRepository.save.mockResolvedValue({});
      mockStructuredDataRepository.save.mockResolvedValue({});

      const result = await useCase.execute(input);

      const description = mockScoreCalculator.calculate.mock.calls[0][0].metaDescription;
      expect(description.length).toBeLessThanOrEqual(160);
    });
  });

  describe('Structured Data', () => {
    it('should generate JSON-LD structured data', async () => {
      const product = {
        id: 'prod-010',
        name: 'Structured Data Product',
        description: 'Product with structured data',
        price: 299.99,
        sku: 'STRUCT-001',
        image: 'https://example.com/product.jpg',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-010',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Product',
        description: 'Description.',
        focusKeyword: 'product',
      });
      mockSlugGenerator.generate.mockReturnValue('structured-data-product');
      const structuredData = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: 'Structured Data Product',
        price: 299.99,
        currency: 'RON',
      };
      mockStructuredDataGenerator.generateProduct.mockReturnValue(structuredData);
      mockScoreCalculator.calculate.mockReturnValue(88);
      mockMetadataRepository.save.mockResolvedValue({});
      mockStructuredDataRepository.save.mockResolvedValue({
        jsonLd: structuredData,
      });

      const result = await useCase.execute(input);

      expect(mockStructuredDataGenerator.generateProduct).toHaveBeenCalled();
    });
  });

  describe('Event Publishing', () => {
    it('should publish seo.metadata_generated event', async () => {
      const product = {
        id: 'prod-011',
        name: 'Event Test Product',
        description: 'Test',
        price: 100,
        sku: 'EVENT-001',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-011',
        locale: 'en',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Product',
        description: 'Desc.',
        focusKeyword: 'product',
      });
      mockSlugGenerator.generate.mockReturnValue('event-test-product');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({});
      mockScoreCalculator.calculate.mockReturnValue(80);
      mockMetadataRepository.save.mockResolvedValue({});
      mockStructuredDataRepository.save.mockResolvedValue({});

      await useCase.execute(input);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        'seo.metadata_generated',
        expect.objectContaining({
          productId: 'prod-011',
          locale: 'en',
          score: 80,
          focusKeyword: 'product',
        })
      );
    });
  });

  describe('Logging', () => {
    it('should log generation start and completion', async () => {
      const product = {
        id: 'prod-012',
        name: 'Log Test',
        description: 'Test',
        price: 50,
        sku: 'LOG-001',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-012',
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Log',
        description: 'Test.',
        focusKeyword: 'log',
      });
      mockSlugGenerator.generate.mockReturnValue('log-test');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({});
      mockScoreCalculator.calculate.mockReturnValue(75);
      mockMetadataRepository.save.mockResolvedValue({});
      mockStructuredDataRepository.save.mockResolvedValue({});

      await useCase.execute(input);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Generating SEO metadata for product',
        expect.objectContaining({
          productId: 'prod-012',
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'SEO metadata generated successfully',
        expect.objectContaining({
          productId: 'prod-012',
          score: 75,
        })
      );
    });
  });

  describe('Default Locale', () => {
    it('should use Romanian locale as default', async () => {
      const product = {
        id: 'prod-013',
        name: 'Default Locale Test',
        description: 'Test',
        price: 80,
        sku: 'DEF-001',
      };

      const input: GenerateProductSeoInput = {
        productId: 'prod-013',
        // No locale specified
      };

      mockProductPort.getProduct.mockResolvedValue(product);
      mockMetaTagGenerator.generateForProduct.mockReturnValue({
        title: 'Default',
        description: 'Test.',
        focusKeyword: 'default',
      });
      mockSlugGenerator.generate.mockReturnValue('default-locale-test');
      mockStructuredDataGenerator.generateProduct.mockReturnValue({});
      mockScoreCalculator.calculate.mockReturnValue(78);
      mockMetadataRepository.save.mockResolvedValue({});
      mockStructuredDataRepository.save.mockResolvedValue({});

      await useCase.execute(input);

      const metadataCall = mockMetadataRepository.save.mock.calls[0][0];
      expect(metadataCall.locale).toBe('ro');
    });
  });
});
