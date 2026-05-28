import axios from 'axios';
import fs from 'fs';
import path from 'path';

import { ProductImageSearchService } from '../../modules/inventory/src/application/services/ProductImageSearchService';
import { serializeB2BParams } from '../../frontend/src/services/b2b-params';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      delete: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    })),
    get: jest.fn(),
    head: jest.fn(),
  },
}));

const projectRoot = path.resolve(__dirname, '../..');
const b2bApiPath = path.join(projectRoot, 'frontend/src/services/b2b-api.ts');

describe('B2B filter mapping policy', () => {
  it('normalizes backend facet keys used by the catalog page', () => {
    const source = fs.readFileSync(b2bApiPath, 'utf8');

    expect(source).toContain('brand: this.normalizeFilterOptions(data?.brands)');
    expect(source).toContain('mountingType: this.normalizeFilterOptions(data?.mounting_types)');
    expect(source).toContain('stripType: this.normalizeFilterOptions(data?.strip_types)');
    expect(source).toContain('ledVoltage: this.normalizeFilterOptions(data?.led_voltages)');
    expect(source).toContain('lightColor: this.normalizeFilterOptions(data?.light_colors)');
  });

  it('serializes array query params as repeated keys without bracket suffixes', () => {
    const query = serializeB2BParams({
      brand: ['aca lighting', 'led profiles'],
      kelvin: ['3000'],
      page: 1,
    });

    expect(query).toBe('brand=aca+lighting&brand=led+profiles&kelvin=3000&page=1');
    expect(query).not.toContain('brand%5B%5D');
    expect(query).not.toContain('kelvin%5B%5D');
  });
});

describe('Product image search download policy', () => {
  it('does not persist downloaded SVG images', () => {
    const source = fs.readFileSync(
      path.join(projectRoot, 'modules/inventory/src/application/services/ProductImageSearchService.ts'),
      'utf8',
    );

    expect(source).not.toContain("'image/svg+xml': '.svg'");
    expect(source).toContain('detectAllowedImageExtension');
    expect(source).toContain('maxContentLength: 5 * 1024 * 1024');
  });

  it('rejects spoofed SVG downloads without writing files', async () => {
    const mockedAxios = axios as jest.Mocked<typeof axios>;
    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    mockedAxios.get.mockResolvedValueOnce({
      data: Buffer.from('<svg><script>alert(1)</script></svg>'),
      headers: { 'content-type': 'image/png' },
    });
    const service = new ProductImageSearchService();

    try {
      const result = await service.downloadExternalImage('https://example.com/spoofed.png', 123, 'SKU-1');

      expect(result).toBeNull();
      expect(writeSpy).not.toHaveBeenCalled();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com/spoofed.png',
        expect.objectContaining({ maxContentLength: 5 * 1024 * 1024 }),
      );
    } finally {
      writeSpy.mockRestore();
    }
  });
});
