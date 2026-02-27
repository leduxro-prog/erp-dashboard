import { Request } from 'express';

import {
  InventoryControllerHelpers,
  type InventoryCursor,
} from './InventoryControllerHelpers';

type StockStatus = '' | 'normal' | 'warning' | 'critical';

export interface ParsedStockLevelsQuery {
  page: number;
  limit: number;
  offset: number;
  search: string;
  cursorToken: string;
  cursorDirection: 'next' | 'prev';
  cursorData: InventoryCursor | null;
  isCursorMode: boolean;
  fetchDirection: 'ASC' | 'DESC';
  effectiveLimit: number;
  category: string;
  stripTypes: string[];
  ledVoltages: number[];
  lightColors: string[];
  kelvinFilters: string[];
  ipFilters: string[];
  brandFilters: string[];
  mountingTypeFilters: string[];
  protocolFilters: string[];
  cctvResolutionFilters: string[];
  stockStatus: StockStatus;
}

export class InventoryStockLevelsQueryParser {
  constructor(private readonly helpers: InventoryControllerHelpers) {}

  parse(query: Request['query']): ParsedStockLevelsQuery {
    const page = Math.max(parseInt(query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit as string) || 50, 1), 200);
    const search = (query.search as string) || '';
    const cursorToken = String(query.cursor || '').trim();
    const cursorDirection: 'next' | 'prev' = query.direction === 'prev' ? 'prev' : 'next';
    const cursorData = cursorToken ? this.helpers.decodeInventoryCursor(cursorToken) : null;
    const isCursorMode = Boolean(cursorToken && cursorData);
    const fetchDirection: 'ASC' | 'DESC' =
      isCursorMode && cursorDirection === 'prev' ? 'DESC' : 'ASC';
    const effectiveLimit = isCursorMode ? limit + 1 : limit;
    const category = String(query.category || '').trim();

    const stripTypes = this.unique(
      this.helpers
        .parseMultiValue(query.stripType ?? query.strip_type)
        .map((value) => value.toLowerCase())
        .filter((value) => value.length > 0),
    );

    const ledVoltages = this.unique(
      this.helpers
        .parseMultiValue(query.ledVoltage ?? query.led_voltage ?? query.voltage)
        .map((value) => parseInt(value, 10))
        .filter((value) => Number.isFinite(value)),
    );

    const lightColors = this.unique(
      this.helpers
        .parseMultiValue(query.lightColor ?? query.light_color ?? query.colorTemperature)
        .map((value) => this.helpers.normalizeLedColorFilterValue(value))
        .filter((value) => value.length > 0),
    );

    const kelvinFilters = this.unique(
      this.helpers
        .parseMultiValue(query.kelvin)
        .map((value) => this.helpers.normalizeLedColorFilterValue(value))
        .filter((value) => /^\d{4}$/.test(value)),
    );

    const ipFilters = this.unique(
      this.helpers
        .parseMultiValue(query.ip)
        .map((value) => value.toUpperCase())
        .filter((value) => value.length > 0),
    );

    const brandFilters = this.unique(
      this.helpers
        .parseMultiValue(query.brand)
        .map((value) => value.toLowerCase())
        .filter((value) => value.length > 0),
    );

    const mountingTypeFilters = this.unique(
      this.helpers
        .parseMultiValue(query.mountingType ?? query.mounting_type)
        .map((value) => value.toLowerCase())
        .filter((value) => value.length > 0),
    );

    const protocolFilters = this.unique(
      this.helpers
        .parseMultiValue(query.protocol)
        .map((value) => value.toLowerCase())
        .filter((value) => value.length > 0),
    );

    const cctvResolutionFilters = this.unique(
      this.helpers
        .parseMultiValue(query.resolution)
        .map((value) => value.toLowerCase())
        .filter((value) => value.length > 0),
    );

    const rawStatus = String(query.status || '')
      .trim()
      .toLowerCase();
    const stockStatus: StockStatus =
      rawStatus === 'normal' || rawStatus === 'warning' || rawStatus === 'critical'
        ? rawStatus
        : '';

    return {
      page,
      limit,
      offset: (page - 1) * limit,
      search,
      cursorToken,
      cursorDirection,
      cursorData,
      isCursorMode,
      fetchDirection,
      effectiveLimit,
      category,
      stripTypes,
      ledVoltages,
      lightColors,
      kelvinFilters,
      ipFilters,
      brandFilters,
      mountingTypeFilters,
      protocolFilters,
      cctvResolutionFilters,
      stockStatus,
    };
  }

  private unique<T>(values: T[]): T[] {
    return Array.from(new Set(values));
  }
}
