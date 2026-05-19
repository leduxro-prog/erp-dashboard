import {
  ISmartBillApiClientCatalog,
  RegisterCatalogProductUseCase,
} from '../../src/application/use-cases/RegisterCatalogProduct';
import { SmartBillError } from '../../src/application/errors/smartbill.errors';

describe('RegisterCatalogProductUseCase', () => {
  let useCase: RegisterCatalogProductUseCase;
  let mockApiClient: jest.Mocked<ISmartBillApiClientCatalog>;

  beforeEach(() => {
    mockApiClient = {
      createInvoiceRaw: jest.fn(),
      getTaxes: jest.fn(),
    };

    useCase = new RegisterCatalogProductUseCase(mockApiClient);
  });

  test('should register catalog product with resolved tax from SmartBill', async () => {
    mockApiClient.getTaxes.mockResolvedValue([
      { name: 'Redusa', percentage: 11 },
      { name: 'Normala', percentage: 21 },
    ]);
    mockApiClient.createInvoiceRaw.mockResolvedValue({
      number: '123',
      series: 'FL',
      status: 'draft',
    });

    const result = await useCase.execute({
      sku: 'SKU-001',
      name: 'Produs test',
      price: 49.9,
      currency: 'ron',
    });

    expect(mockApiClient.createInvoiceRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        isDraft: true,
        currency: 'RON',
        products: [
          expect.objectContaining({
            code: 'SKU-001',
            name: 'Produs test',
            taxName: 'Normala',
            taxPercentage: 21,
            saveToDb: true,
          }),
        ],
      }),
    );

    expect(result.saved).toBe(true);
    expect(result.product.taxName).toBe('Normala');
    expect(result.product.taxPercentage).toBe(21);
    expect(result.product.currency).toBe('RON');
  });

  test('should use provided tax values and skip tax lookup', async () => {
    mockApiClient.createInvoiceRaw.mockResolvedValue({ status: 'draft' });

    const result = await useCase.execute({
      sku: 'SKU-002',
      name: 'Produs custom tax',
      taxName: 'TVA Personalizat',
      taxPercentage: 7,
    });

    expect(mockApiClient.getTaxes).not.toHaveBeenCalled();
    expect(result.product.taxName).toBe('TVA Personalizat');
    expect(result.product.taxPercentage).toBe(7);
  });

  test('should resolve tax percentage by provided tax name', async () => {
    mockApiClient.getTaxes.mockResolvedValue([
      { name: 'Normala', percentage: 21 },
      { name: 'Redusa', percentage: 11 },
    ]);
    mockApiClient.createInvoiceRaw.mockResolvedValue({ status: 'draft' });

    const result = await useCase.execute({
      sku: 'SKU-003',
      name: 'Produs nume taxa',
      taxName: 'redusa',
    });

    expect(result.product.taxName).toBe('Redusa');
    expect(result.product.taxPercentage).toBe(11);
  });

  test('should fail when tax lookup is unavailable and tax input is partial', async () => {
    mockApiClient.getTaxes.mockRejectedValue(new Error('network error'));

    await expect(
      useCase.execute({
        sku: 'SKU-004',
        name: 'Produs invalid tax setup',
        taxName: 'Normala',
      }),
    ).rejects.toThrow(SmartBillError);

    await expect(
      useCase.execute({
        sku: 'SKU-004',
        name: 'Produs invalid tax setup',
        taxPercentage: 19,
      }),
    ).rejects.toThrow('Could not validate tax configuration from SmartBill');
  });

  test('should fallback to defaults for invalid input values', async () => {
    mockApiClient.getTaxes.mockResolvedValue([]);
    mockApiClient.createInvoiceRaw.mockResolvedValue({ status: 'draft' });

    const result = await useCase.execute({
      sku: '  SKU-005  ',
      name: '  Produs default  ',
      price: 0,
      measuringUnit: '   ',
      currency: 'eurx',
    });

    expect(result.product.sku).toBe('SKU-005');
    expect(result.product.name).toBe('Produs default');
    expect(result.product.price).toBe(1);
    expect(result.product.measuringUnit).toBe('buc');
    expect(result.product.currency).toBe('EUR');
    expect(result.product.taxName).toBe('Normala');
    expect(result.product.taxPercentage).toBe(19);
  });
});
