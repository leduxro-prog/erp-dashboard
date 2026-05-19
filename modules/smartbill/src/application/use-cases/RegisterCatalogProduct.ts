import { createModuleLogger } from '@shared/utils/logger';

import { RegisterCatalogProductDto, RegisterCatalogProductResultDto } from '../dtos/smartbill.dtos';
import { SmartBillError } from '../errors/smartbill.errors';

const logger = createModuleLogger('smartbill-register-catalog-product');

interface SmartBillTaxInfo {
  name: string;
  percentage: number;
}

export interface ISmartBillApiClientCatalog {
  createInvoiceRaw(payload: any): Promise<{ number?: string; status?: string; series?: string }>;
  getTaxes(): Promise<SmartBillTaxInfo[]>;
}

export class RegisterCatalogProductUseCase {
  constructor(private readonly apiClient: ISmartBillApiClientCatalog) {}

  async execute(dto: RegisterCatalogProductDto): Promise<RegisterCatalogProductResultDto> {
    const price = Number.isFinite(dto.price) && (dto.price as number) > 0 ? Number(dto.price) : 1;
    const currency = (dto.currency || 'RON').toUpperCase().slice(0, 3);
    const measuringUnit = (dto.measuringUnit || 'buc').trim() || 'buc';
    const sku = dto.sku.trim();
    const name = dto.name.trim();
    const isService = dto.isService === true;
    const isTaxIncluded = dto.isTaxIncluded !== false;

    const resolvedTax = await this.resolveTax(dto);

    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 7);

    const payload = {
      companyVatCode: process.env.SMARTBILL_COMPANY_VAT || undefined,
      client: {
        name: 'Catalog Product Registration',
        vatCode: '0000000000000',
        address: '-',
        isTaxPayer: false,
        city: 'Bucuresti',
        county: 'Bucuresti',
        country: 'Romania',
        saveToDb: false,
      },
      isDraft: true,
      issueDate: today.toISOString().split('T')[0],
      seriesName: process.env.SMARTBILL_INVOICE_SERIES || 'FL',
      dueDate: dueDate.toISOString().split('T')[0],
      currency,
      useStock: false,
      products: [
        {
          name,
          code: sku,
          isDiscount: false,
          measuringUnitName: measuringUnit,
          currency,
          quantity: 1,
          price,
          isTaxIncluded,
          taxName: resolvedTax.taxName,
          taxPercentage: resolvedTax.taxPercentage,
          isService,
          saveToDb: true,
        },
      ],
    };

    const response = await this.apiClient.createInvoiceRaw(payload);

    logger.info('SmartBill catalog product registration executed', {
      sku,
      isDraft: true,
      hasNumber: Boolean(response.number),
    });

    return {
      saved: true,
      product: {
        sku,
        name,
        price,
        currency,
        measuringUnit,
        isService,
        isTaxIncluded,
        taxName: resolvedTax.taxName,
        taxPercentage: resolvedTax.taxPercentage,
      },
      document: {
        isDraft: true,
        series: response.series,
        number: response.number,
        status: response.status || 'draft',
      },
    };
  }

  private async resolveTax(
    dto: RegisterCatalogProductDto,
  ): Promise<{ taxName: string; taxPercentage: number }> {
    const hasTaxName = Boolean(dto.taxName && dto.taxName.trim().length > 0);
    const hasTaxPercentage = Number.isFinite(dto.taxPercentage as number);

    if (hasTaxName && hasTaxPercentage) {
      return {
        taxName: dto.taxName!.trim(),
        taxPercentage: Number(dto.taxPercentage),
      };
    }

    let taxes: SmartBillTaxInfo[] = [];
    try {
      taxes = await this.apiClient.getTaxes();
    } catch (error) {
      if (hasTaxName || hasTaxPercentage) {
        throw new SmartBillError(
          'Could not validate tax configuration from SmartBill. Provide both taxName and taxPercentage or retry.',
          'CATALOG_TAX_RESOLUTION_FAILED',
        );
      }
    }

    const normalizedTaxes = taxes
      .map((tax) => ({
        name: String(tax.name || '').trim(),
        percentage: Number(tax.percentage),
      }))
      .filter((tax) => tax.name.length > 0 && Number.isFinite(tax.percentage));

    if (hasTaxName) {
      const byName = normalizedTaxes.find(
        (tax) => tax.name.toLowerCase() === dto.taxName!.trim().toLowerCase(),
      );
      if (byName) {
        return { taxName: byName.name, taxPercentage: byName.percentage };
      }
    }

    if (hasTaxPercentage) {
      const byPercentage = normalizedTaxes.find(
        (tax) => Number(tax.percentage) === Number(dto.taxPercentage),
      );
      if (byPercentage) {
        return { taxName: byPercentage.name, taxPercentage: byPercentage.percentage };
      }
    }

    const positiveTaxes = normalizedTaxes.filter((tax) => tax.percentage > 0);
    if (positiveTaxes.length > 0) {
      const preferred = positiveTaxes.sort((a, b) => b.percentage - a.percentage)[0];
      return { taxName: preferred.name, taxPercentage: preferred.percentage };
    }

    if (normalizedTaxes.length > 0) {
      return {
        taxName: normalizedTaxes[0].name,
        taxPercentage: normalizedTaxes[0].percentage,
      };
    }

    return {
      taxName: 'Normala',
      taxPercentage: 19,
    };
  }
}
