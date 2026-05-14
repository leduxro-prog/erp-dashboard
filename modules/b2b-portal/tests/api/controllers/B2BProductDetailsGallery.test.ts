import { NextFunction, Response } from 'express';
import { EventEmitter } from 'events';
import { promises as dns } from 'dns';
import http from 'http';

import { B2BController } from '../../../src/api/controllers/B2BController';
import { B2BOrderController } from '../../../src/api/controllers/B2BOrderController';
import { listProductsSchema } from '../../../src/api/validators/b2b.validators';

describe('B2BController.getProductDetails gallery images', () => {
  const buildController = (dataSourceMock: { query: jest.Mock }) =>
    new B2BController(
      { execute: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSourceMock as any,
    );

  const buildResponse = () => {
    const res: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      setHeader: jest.fn(),
    };

    return res;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns images[] for projection-backed product details', async () => {
    const dataSourceMock = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ table_name: 'inventory_product_projection' }])
        .mockResolvedValueOnce([
          {
            id: '6263142',
            sku: 'TR007-1-18W3K-W-1',
            name: 'Track luminaire',
            description: '',
            price: '325.49',
            currency: 'EUR',
            primary_image_url: 'https://cdn.example.com/uploads/products/6263142/main.webp',
            category_raw: 'Diverse',
            category_root: 'Iluminat Interior',
            supplier_name: 'Business Central',
            brand: 'Maytoni',
            mounting_type: null,
            ip_rating: 'IP20',
            color_temperature: 3000,
            wattage: '18.00',
            lumens: 1490,
            cri: 90,
            beam_angle: 120,
            voltage_input: '220-240V',
            custom_specs: null,
            local_stock: '2',
            supplier_stock: '3',
            total_stock: '5',
            supplier_lead_time: '3',
          },
        ])
        .mockResolvedValueOnce([
          {
            image_url: 'https://cdn.example.com/uploads/products/6263142/main.webp',
            alt_text: 'main',
            sort_order: 0,
            is_primary: true,
          },
          {
            image_url: 'https://cdn.example.com/uploads/products/6263142/side.webp',
            alt_text: 'side',
            sort_order: 1,
            is_primary: false,
          },
        ]),
    };

    const controller = buildController(dataSourceMock);
    const req = { params: { id: '6263142' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.getProductDetails(req, res as Response, next);

    expect((res.status as jest.Mock)).toHaveBeenCalledWith(200);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          image_url: 'https://cdn.example.com/uploads/products/6263142/main.webp',
          images: [
            expect.objectContaining({
              url: 'https://cdn.example.com/uploads/products/6263142/main.webp',
              alt_text: 'main',
              sort_order: 0,
              is_primary: true,
            }),
            expect.objectContaining({
              url: 'https://cdn.example.com/uploads/products/6263142/side.webp',
              alt_text: 'side',
              sort_order: 1,
              is_primary: false,
            }),
          ],
        }),
      }),
    );
  });

  it('returns images[] for fallback SQL details when projection is unavailable', async () => {
    const dataSourceMock = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ table_name: null }])
        .mockResolvedValueOnce([
          {
            id: '42',
            sku: 'SKU-42',
            name: 'Fallback product',
            description: 'desc',
            price: '99.00',
            currency: 'RON',
            image_url: 'https://cdn.example.com/products/42/main.webp',
            category_raw: 'Diverse',
            category_root: 'Diverse',
            supplier_name: 'Supplier',
            brand_effective: 'Brand',
            mounting_type: null,
            ip_rating: null,
            color_temperature: null,
            wattage: null,
            lumens: null,
            cri: null,
            beam_angle: null,
            voltage_input: null,
            custom_specs: null,
            stock_local: '0',
            stock_supplier: '0',
            supplier_lead_time: '3',
          },
        ])
        .mockResolvedValueOnce([
          {
            image_url: 'https://cdn.example.com/products/42/main.webp',
            alt_text: 'main',
            sort_order: 0,
            is_primary: true,
          },
          {
            image_url: 'https://cdn.example.com/products/42/detail.webp',
            alt_text: null,
            sort_order: 2,
            is_primary: false,
          },
        ]),
    };

    const controller = buildController(dataSourceMock);
    const req = { params: { id: '42' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.getProductDetails(req, res as Response, next);

    expect((res.status as jest.Mock)).toHaveBeenCalledWith(200);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          image_url: 'https://cdn.example.com/products/42/main.webp',
          images: [
            expect.objectContaining({
              url: 'https://cdn.example.com/products/42/main.webp',
              alt_text: 'main',
              sort_order: 0,
              is_primary: true,
            }),
            expect.objectContaining({
              url: 'https://cdn.example.com/products/42/detail.webp',
              sort_order: 2,
              is_primary: false,
            }),
          ],
        }),
      }),
    );
  });

  it('falls back to primary image_url when product_images has no rows', async () => {
    const dataSourceMock = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ table_name: 'inventory_product_projection' }])
        .mockResolvedValueOnce([
          {
            id: '314',
            sku: 'SKU-314',
            name: 'Primary only product',
            description: '',
            price: '10.00',
            currency: 'RON',
            primary_image_url: 'https://cdn.example.com/products/314/main.webp',
            category_raw: 'Diverse',
            category_root: 'Diverse',
            supplier_name: 'Supplier',
            brand: 'Brand',
            mounting_type: null,
            ip_rating: null,
            color_temperature: null,
            wattage: null,
            lumens: null,
            cri: null,
            beam_angle: null,
            voltage_input: null,
            custom_specs: null,
            local_stock: '0',
            supplier_stock: '0',
            total_stock: '0',
            supplier_lead_time: '3',
          },
        ])
        .mockResolvedValueOnce([]),
    };

    const controller = buildController(dataSourceMock);
    const req = { params: { id: '314' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.getProductDetails(req, res as Response, next);

    expect((res.status as jest.Mock)).toHaveBeenCalledWith(200);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          image_url: 'https://cdn.example.com/products/314/main.webp',
          images: [
            expect.objectContaining({
              url: 'https://cdn.example.com/products/314/main.webp',
              is_primary: true,
              sort_order: 0,
            }),
          ],
        }),
      }),
    );
  });

  it('uses a public object storage asset when product_images and primary image are unsafe', async () => {
    const publicAssetUrl =
      'https://cypher-erp-prod-files.hel1.your-objectstorage.com/products/16112/MDIFW.webp';
    const dataSourceMock = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ table_name: 'inventory_product_projection' }])
        .mockResolvedValueOnce([
          {
            id: '16112',
            sku: 'MDIFW',
            name: 'Safe asset fallback product',
            description: '',
            price: '10.00',
            currency: 'RON',
            primary_image_url: '/optimized/uploads/optimized/products/16112/4497.webp',
            category_raw: 'Diverse',
            category_root: 'Diverse',
            supplier_name: 'Supplier',
            brand: 'Brand',
            mounting_type: null,
            ip_rating: null,
            color_temperature: null,
            wattage: null,
            lumens: null,
            cri: null,
            beam_angle: null,
            voltage_input: null,
            custom_specs: null,
            local_stock: '0',
            supplier_stock: '0',
            total_stock: '0',
            supplier_lead_time: '3',
          },
        ])
        .mockResolvedValueOnce([
          {
            image_url: '/optimized/uploads/optimized/products/16112/4497.webp',
            alt_text: 'legacy local',
            sort_order: 0,
            is_primary: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            storage_url: publicAssetUrl,
            source_url: '/optimized/uploads/optimized/products/16112/4497.webp',
            alt_text: 'public asset',
            sort_order: 0,
            is_primary: true,
          },
        ]),
    };

    const controller = buildController(dataSourceMock);
    const req = { params: { id: '16112' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.getProductDetails(req, res as Response, next);

    expect((res.status as jest.Mock)).toHaveBeenCalledWith(200);
    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody.data.image_url).toBe(publicAssetUrl);
    expect(responseBody.data.images[0]).toEqual(
      expect.objectContaining({
        url: publicAssetUrl,
        is_primary: true,
      }),
    );
    for (const image of responseBody.data.images) {
      expect(image.url).not.toMatch(/^\/optimized\/uploads\//);
      expect(image.url).not.toMatch(/^\/uploads\//);
    }
  });

  it('rejects local product asset paths when no public image candidate exists', async () => {
    const dataSourceMock = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ table_name: 'inventory_product_projection' }])
        .mockResolvedValueOnce([
          {
            id: '16112',
            sku: 'MDIFW',
            name: 'Unsafe local asset product',
            description: '',
            price: '10.00',
            currency: 'RON',
            primary_image_url: '/optimized/uploads/optimized/products/16112/4497.webp',
            category_raw: 'Diverse',
            category_root: 'Diverse',
            supplier_name: 'Supplier',
            brand: 'Brand',
            mounting_type: null,
            ip_rating: null,
            color_temperature: null,
            wattage: null,
            lumens: null,
            cri: null,
            beam_angle: null,
            voltage_input: null,
            custom_specs: null,
            local_stock: '0',
            supplier_stock: '0',
            total_stock: '0',
            supplier_lead_time: '3',
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            storage_url: '/uploads/optimized/products/16112/4497.webp',
            source_url: '',
            alt_text: 'local asset',
            sort_order: 0,
            is_primary: true,
          },
        ]),
    };

    const controller = buildController(dataSourceMock);
    const req = { params: { id: '16112' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.getProductDetails(req, res as Response, next);

    expect((res.status as jest.Mock)).toHaveBeenCalledWith(200);
    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody.data.image_url).toBe('');
    expect(responseBody.data.images).toEqual([]);
  });

  it('uses safe source_url when product asset storage_url is unsafe', async () => {
    const sourceUrl = 'https://cdn.example.com/products/16112/source.webp';
    const dataSourceMock = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ table_name: 'inventory_product_projection' }])
        .mockResolvedValueOnce([
          {
            id: '16112',
            sku: 'MDIFW',
            name: 'Source asset product',
            description: '',
            price: '10.00',
            currency: 'RON',
            primary_image_url: '/optimized/uploads/optimized/products/16112/4497.webp',
            category_raw: 'Diverse',
            category_root: 'Diverse',
            supplier_name: 'Supplier',
            brand: 'Brand',
            mounting_type: null,
            ip_rating: null,
            color_temperature: null,
            wattage: null,
            lumens: null,
            cri: null,
            beam_angle: null,
            voltage_input: null,
            custom_specs: null,
            local_stock: '0',
            supplier_stock: '0',
            total_stock: '0',
            supplier_lead_time: '3',
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            storage_url: '/uploads/optimized/products/16112/4497.webp',
            source_url: sourceUrl,
            alt_text: 'source asset',
            sort_order: 0,
            is_primary: true,
          },
        ]),
    };

    const controller = buildController(dataSourceMock);
    const req = { params: { id: '16112' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.getProductDetails(req, res as Response, next);

    expect((res.status as jest.Mock)).toHaveBeenCalledWith(200);
    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody.data.image_url).toBe(sourceUrl);
    expect(responseBody.data.images[0]).toEqual(
      expect.objectContaining({
        url: sourceUrl,
        is_primary: true,
      }),
    );
  });

  it('does not throw when product_assets table is missing', async () => {
    const primaryUrl = 'https://cdn.example.com/uploads/products/16112/main.webp';
    const missingTableError = Object.assign(new Error('relation "product_assets" does not exist'), {
      code: '42P01',
    });
    const dataSourceMock = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ table_name: 'inventory_product_projection' }])
        .mockResolvedValueOnce([
          {
            id: '16112',
            sku: 'MDIFW',
            name: 'Missing assets table product',
            description: '',
            price: '10.00',
            currency: 'RON',
            primary_image_url: primaryUrl,
            category_raw: 'Diverse',
            category_root: 'Diverse',
            supplier_name: 'Supplier',
            brand: 'Brand',
            mounting_type: null,
            ip_rating: null,
            color_temperature: null,
            wattage: null,
            lumens: null,
            cri: null,
            beam_angle: null,
            voltage_input: null,
            custom_specs: null,
            local_stock: '0',
            supplier_stock: '0',
            total_stock: '0',
            supplier_lead_time: '3',
          },
        ])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(missingTableError),
    };

    const controller = buildController(dataSourceMock);
    const req = { params: { id: '16112' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.getProductDetails(req, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(200);
    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody.data.image_url).toBe(primaryUrl);
    expect(responseBody.data.images[0]).toEqual(
      expect.objectContaining({
        url: primaryUrl,
        is_primary: true,
      }),
    );
  });

  it('allows catalog query params consumed by listProducts', () => {
    const { error, value } = listProductsSchema.validate(
      {
        page: '1',
        limit: '48',
        compact: 'true',
        sort: 'newest',
        search: 'led',
        category: 'Benzi LED',
        stock: 'stock',
        brand: ['LedLine', 'ACA Lighting'],
        kelvin: ['3000', '4000'],
        ip: 'IP65',
        mountingType: 'apparent',
        strip_type: 'cob',
        led_voltage: '24',
        lightColor: 'warm white',
        min_price: '10',
        max_price: '250',
      },
      { abortEarly: false },
    );

    expect(error).toBeUndefined();
    expect(value.compact).toBe(true);
  });

  it('rejects private hosts for document previews', async () => {
    const controller = buildController({ query: jest.fn() });
    const req = { query: { url: 'http://127.0.0.1/internal.pdf' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.previewDocument(req, res as Response, next);

    expect((res.status as jest.Mock)).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INVALID_DOCUMENT_URL' }),
      }),
    );
  });

  it('applies stock=stock to projection-backed product queries', async () => {
    const dataSourceMock = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ table_name: 'inventory_product_projection' }])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]),
    };
    const controller = buildController(dataSourceMock);
    const req = { query: { stock: 'stock' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.listProducts(req, res as Response, next);

    expect(dataSourceMock.query.mock.calls[1][0]).toContain(
      '(ip.local_stock > 0 OR ip.supplier_stock > 0)',
    );
    expect(dataSourceMock.query.mock.calls[2][0]).toContain(
      '(ip.local_stock > 0 OR ip.supplier_stock > 0)',
    );
  });

  it('does not return unsafe projection image URLs in catalog list responses', async () => {
    const dataSourceMock = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ table_name: 'inventory_product_projection' }])
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([
          {
            id: '16112',
            sku: 'MDIFW',
            name: 'Unsafe list image product',
            description: '',
            price: '10.00',
            currency: 'RON',
            primary_image_url: '/optimized/uploads/optimized/products/16112/4497.webp',
            category_raw: 'Diverse',
            category_root: 'Diverse',
            brand: 'Brand',
            mounting_type: null,
            ip_rating: null,
            color_temperature: null,
            supplier_name: 'Supplier',
            local_stock: '0',
            supplier_stock: '0',
            total_stock: '0',
            supplier_lead_time: '3',
          },
        ]),
    };
    const controller = buildController(dataSourceMock);
    const req = { query: {} } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.listProducts(req, res as Response, next);

    const responseBody = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseBody.data.products[0].image_url).toBe('');
  });

  it('applies stock=stock to fallback product queries', async () => {
    const dataSourceMock = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ table_name: null }])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]),
    };
    const controller = buildController(dataSourceMock);
    const req = { query: { stock: 'stock' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.listProducts(req, res as Response, next);

    expect(dataSourceMock.query.mock.calls[1][0]).toContain('sc2.quantity_available > 0');
    expect(dataSourceMock.query.mock.calls[1][0]).toContain('sl2.quantity_available > 0');
    expect(dataSourceMock.query.mock.calls[1][0]).toContain('OR EXISTS');
    expect(dataSourceMock.query.mock.calls[2][0]).toContain('sc2.quantity_available > 0');
    expect(dataSourceMock.query.mock.calls[2][0]).toContain('sl2.quantity_available > 0');
    expect(dataSourceMock.query.mock.calls[2][0]).toContain('OR EXISTS');
  });

  it('rejects document previews when DNS resolves to a private address', async () => {
    jest.spyOn(dns, 'lookup').mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as any);
    const httpGetSpy = jest.spyOn(http, 'get');
    const controller = buildController({ query: jest.fn() });
    const req = { query: { url: 'http://supplier.example/file.pdf' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.previewDocument(req, res as Response, next);

    expect(httpGetSpy).not.toHaveBeenCalled();
    expect((res.status as jest.Mock)).toHaveBeenCalledWith(400);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INVALID_DOCUMENT_URL' }),
      }),
    );
  });

  it('uses the validated DNS address for document preview fetches', async () => {
    jest.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as any);
    const request = new EventEmitter() as EventEmitter & {
      on: jest.Mock;
      destroy: jest.Mock;
    };
    request.on = jest.fn((event: string, handler: (...args: any[]) => void) => {
      EventEmitter.prototype.on.call(request, event, handler);
      return request;
    });
    request.destroy = jest.fn();
    const httpGetSpy = jest.spyOn(http, 'get').mockImplementation((_url: any, options: any) => {
      options.lookup('supplier.example', {}, (error: Error | null, address: string, family: number) => {
        expect(error).toBeNull();
        expect(address).toBe('93.184.216.34');
        expect(family).toBe(4);
      });

      process.nextTick(() => request.emit('error', new Error('stop after lookup assertion')));
      return request as any;
    });
    const controller = buildController({ query: jest.fn() });
    const req = { query: { url: 'http://supplier.example/file.pdf' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.previewDocument(req, res as Response, next);

    expect(httpGetSpy).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ timeout: 5000, lookup: expect.any(Function) }),
      expect.any(Function),
    );
  });

  it('exposes a typed order model PDF endpoint without fake generation', async () => {
    const controller = new B2BOrderController({} as any);
    const req = { params: { id: 'order_1' } } as any;
    const res = buildResponse();
    const next: NextFunction = jest.fn();

    await controller.downloadOrderModelPdf(req, res as Response, next);

    expect((res.status as jest.Mock)).toHaveBeenCalledWith(501);
    expect((res.json as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'ORDER_MODEL_PDF_NOT_IMPLEMENTED' }),
      }),
    );
  });
});
