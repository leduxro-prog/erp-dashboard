import { NextFunction, Response } from 'express';
import { B2BController } from '../../../src/api/controllers/B2BController';

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
    };

    return res;
  };

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
            primary_image_url: '/uploads/products/6263142/main.webp',
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
            image_url: '/uploads/products/6263142/main.webp',
            alt_text: 'main',
            sort_order: 0,
            is_primary: true,
          },
          {
            image_url: '/uploads/products/6263142/side.webp',
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
          image_url: '/uploads/products/6263142/main.webp',
          images: [
            expect.objectContaining({
              url: '/uploads/products/6263142/main.webp',
              alt_text: 'main',
              sort_order: 0,
              is_primary: true,
            }),
            expect.objectContaining({
              url: '/uploads/products/6263142/side.webp',
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
            image_url: '/uploads/products/42/main.webp',
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
            image_url: '/uploads/products/42/main.webp',
            alt_text: 'main',
            sort_order: 0,
            is_primary: true,
          },
          {
            image_url: '/uploads/products/42/detail.webp',
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
          image_url: '/uploads/products/42/main.webp',
          images: [
            expect.objectContaining({
              url: '/uploads/products/42/main.webp',
              alt_text: 'main',
              sort_order: 0,
              is_primary: true,
            }),
            expect.objectContaining({
              url: '/uploads/products/42/detail.webp',
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
            primary_image_url: '/uploads/products/314/main.webp',
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
          image_url: '/uploads/products/314/main.webp',
          images: [
            expect.objectContaining({
              url: '/uploads/products/314/main.webp',
              is_primary: true,
              sort_order: 0,
            }),
          ],
        }),
      }),
    );
  });
});
