import axios, { AxiosError } from 'axios';
import { createModuleLogger } from '@shared/utils/logger';
import { RedisPool } from '@shared/cache/redis-pool';
import type { RedisClientType } from 'redis';

const logger = createModuleLogger('anaf-validation-service');

export interface CompanyInfo {
  cui: string;
  denumire: string;
  adresa: string;
  nrRegCom: string;
  telefon?: string;
  codPostal?: string;
  stareInregistrare: string;
  dataInregistrare?: string;
  codCAEN?: string;
  scpTVA: boolean;
  dataInceputTVA?: string | null;
  dataSfarsitTVA?: string | null;
  statusTVA: boolean;
  statusInactivi: boolean;
  dataInactivare?: string | null;
  dataReactivare?: string | null;
  statusSplitTVA: boolean;
  organFiscalCompetent?: string;
  formaJuridica?: string;
  statusROeFactura: boolean;
  validatedAt: string;
  source: 'anaf' | 'cache';
}

export interface AnafValidationResult {
  valid: boolean;
  company?: CompanyInfo;
  error?: string;
  code?: 'INVALID_FORMAT' | 'NOT_FOUND' | 'ANAF_UNAVAILABLE' | 'CACHE_ERROR';
}

const ANAF_API_VERSIONS = ['v9', 'v8', 'v7'];
const ANAF_BASE_URL = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest';
const CACHE_PREFIX = 'anaf:cui:';
const CACHE_TTL_SECONDS = 24 * 60 * 60;

export class AnafValidationService {
  private redisClient: RedisClientType | null = null;
  private redisEnabled: boolean = false;
  private redisInitInFlight: Promise<void> | null = null;

  constructor() {
    void this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    if (this.redisInitInFlight) {
      return this.redisInitInFlight;
    }

    this.redisInitInFlight = (async (): Promise<void> => {
      try {
        const pool = RedisPool.getInstance();
        this.redisClient = pool.getClient() as RedisClientType;
        this.redisEnabled = true;
        logger.info('Redis cache enabled for ANAF validation');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.redisEnabled = false;

        if (message.includes('No Redis clients available in pool')) {
          logger.info('Redis pool not ready yet for ANAF cache, will retry lazily');
        } else {
          logger.warn('Redis not available, caching disabled', { error: message });
        }
      } finally {
        this.redisInitInFlight = null;
      }
    })();

    return this.redisInitInFlight;
  }

  private async ensureRedisClient(): Promise<void> {
    if (this.redisEnabled && this.redisClient) {
      return;
    }

    await this.initializeRedis();
  }

  async validateCui(cui: string): Promise<AnafValidationResult> {
    const cleanCui = this.cleanCui(cui);

    const formatValidation = this.validateCuiFormat(cleanCui);
    if (!formatValidation.valid) {
      return {
        valid: false,
        error: formatValidation.error,
        code: 'INVALID_FORMAT',
      };
    }

    const cachedResult = await this.getFromCache(cleanCui);
    if (cachedResult) {
      logger.debug('CUI found in cache', { cui: cleanCui });
      return {
        valid: true,
        company: { ...cachedResult, source: 'cache' },
      };
    }

    const anafResult = await this.queryAnafApi(cleanCui);

    if (anafResult.valid && anafResult.company) {
      await this.setCache(cleanCui, anafResult.company);
    }

    return anafResult;
  }

  cleanCui(cui: string): string {
    return cui
      .toString()
      .trim()
      .replace(/^RO/i, '')
      .replace(/[^0-9]/g, '');
  }

  validateCuiFormat(cui: string): { valid: boolean; error?: string } {
    const cleaned = this.cleanCui(cui);

    if (!cleaned) {
      return { valid: false, error: 'CUI is empty or invalid' };
    }

    if (cleaned.length < 2) {
      return { valid: false, error: 'CUI must have at least 2 digits' };
    }

    if (cleaned.length > 10) {
      return { valid: false, error: 'CUI must have at most 10 digits' };
    }

    if (!/^\d{2,10}$/.test(cleaned)) {
      return { valid: false, error: 'CUI must contain only digits (2-10 digits)' };
    }

    const checkDigitValid = this.validateLuhnCheckDigit(cleaned);
    if (!checkDigitValid) {
      logger.debug('CUI checksum warning - proceeding with ANAF validation', { cui: cleaned });
    }

    return { valid: true };
  }

  private validateLuhnCheckDigit(cui: string): boolean {
    const testKey = [7, 5, 3, 2, 1, 7, 5, 3, 2];
    const digits = cui.split('').map(Number);
    const checkDigit = digits[digits.length - 1];

    const cuiWithoutCheck = cui.slice(0, -1).padStart(9, '0').split('').map(Number);

    const sum = cuiWithoutCheck.reduce((acc, digit, index) => {
      return acc + digit * testKey[index];
    }, 0);

    let calculatedCheckDigit = (sum * 10) % 11;
    if (calculatedCheckDigit === 10) {
      calculatedCheckDigit = 0;
    }

    return checkDigit === calculatedCheckDigit;
  }

  private async queryAnafApi(cui: string): Promise<AnafValidationResult> {
    const currentDate = new Date().toISOString().split('T')[0];
    let lastError: Error | null = null;

    for (const version of ANAF_API_VERSIONS) {
      try {
        const url = `${ANAF_BASE_URL}/${version}/tva`;
        
        logger.debug(`Querying ANAF API ${version}`, { cui, url });

        const response = await axios.post(
          url,
          [{ cui: parseInt(cui, 10), data: currentDate }],
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
          }
        );

        const data = response.data;

        if (data.found && data.found.length > 0) {
          const companyData = data.found[0];
          const general = companyData.date_generale || companyData;
          const tvaInfo = companyData.inregistrare_scop_Tva || {};
          const tvaIncasare = companyData.inregistrare_RTVAI || {};
          const stareInactiv = companyData.stare_inactiv || {};
          const splitTva = companyData.inregistrare_SplitTVA || {};
          
          const companyInfo: CompanyInfo = {
            cui: cui,
            denumire: general.denumire || '',
            adresa: general.adresa || '',
            nrRegCom: general.nrRegCom || '',
            telefon: general.telefon || undefined,
            codPostal: general.codPostal || undefined,
            stareInregistrare: general.stare_inregistrare || '',
            dataInregistrare: general.data_inregistrare || undefined,
            codCAEN: general.cod_CAEN || undefined,
            scpTVA: tvaInfo.scpTVA || false,
            dataInceputTVA: tvaIncasare.dataInceputTvaInc || null,
            dataSfarsitTVA: tvaIncasare.dataSfarsitTvaInc || null,
            statusTVA: tvaIncasare.statusTvaIncasare || false,
            statusInactivi: stareInactiv.statusInactivi || false,
            dataInactivare: stareInactiv.dataInactivare || null,
            dataReactivare: stareInactiv.dataReactivare || null,
            statusSplitTVA: splitTva.statusSplitTVA || false,
            organFiscalCompetent: general.organFiscalCompetent || undefined,
            formaJuridica: general.forma_juridica || undefined,
            statusROeFactura: general.statusRO_e_Factura || false,
            validatedAt: new Date().toISOString(),
            source: 'anaf',
          };

          logger.info('CUI validated successfully via ANAF', { 
            cui, 
            version, 
            denumire: companyInfo.denumire 
          });

          return {
            valid: true,
            company: companyInfo,
          };
        }

        if (data.notFound && data.notFound.length > 0) {
          logger.warn('CUI not found in ANAF database', { cui });
          return {
            valid: false,
            error: 'CUI not found in ANAF database. The company may not be registered.',
            code: 'NOT_FOUND',
          };
        }

      } catch (error) {
        const axiosError = error as AxiosError;
        lastError = error as Error;
        logger.debug(`ANAF API ${version} failed`, { 
          cui, 
          error: axiosError.message,
          status: axiosError.response?.status 
        });
        continue;
      }
    }

    logger.error('All ANAF API versions failed', { cui, error: lastError?.message });
    return {
      valid: false,
      error: 'ANAF service is temporarily unavailable. Please try again later.',
      code: 'ANAF_UNAVAILABLE',
    };
  }

  private async getFromCache(cui: string): Promise<CompanyInfo | null> {
    await this.ensureRedisClient();

    if (!this.redisEnabled || !this.redisClient) {
      return null;
    }

    try {
      const cacheKey = `${CACHE_PREFIX}${cui}`;
      const cachedData = await this.redisClient.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData) as CompanyInfo;
      }
    } catch (error) {
      logger.warn('Failed to get CUI from cache', { cui, error });
    }

    return null;
  }

  private async setCache(cui: string, companyInfo: CompanyInfo): Promise<void> {
    await this.ensureRedisClient();

    if (!this.redisEnabled || !this.redisClient) {
      return;
    }

    try {
      const cacheKey = `${CACHE_PREFIX}${cui}`;
      await this.redisClient.setEx(
        cacheKey,
        CACHE_TTL_SECONDS,
        JSON.stringify(companyInfo)
      );
      logger.debug('CUI cached successfully', { cui, ttl: CACHE_TTL_SECONDS });
    } catch (error) {
      logger.warn('Failed to cache CUI data', { cui, error });
    }
  }

  async invalidateCache(cui: string): Promise<void> {
    await this.ensureRedisClient();

    if (!this.redisEnabled || !this.redisClient) {
      return;
    }

    try {
      const cacheKey = `${CACHE_PREFIX}${cui}`;
      await this.redisClient.del(cacheKey);
      logger.info('CUI cache invalidated', { cui });
    } catch (error) {
      logger.warn('Failed to invalidate CUI cache', { cui, error });
    }
  }

  calculateCheckDigit(cuiWithoutCheck: string): number | null {
    const cleaned = cuiWithoutCheck.trim().replace(/[^0-9]/g, '');

    if (!/^\d{1,9}$/.test(cleaned)) {
      return null;
    }

    const testKey = [7, 5, 3, 2, 1, 7, 5, 3, 2];
    const padded = cleaned.padStart(9, '0').split('').map(Number);
    const sum = padded.reduce((acc, digit, index) => {
      return acc + digit * testKey[index];
    }, 0);

    const checkDigit = (sum * 10) % 11;
    return checkDigit === 10 ? 0 : checkDigit;
  }

  normalizeCui(cui: string): string | null {
    const cleaned = this.cleanCui(cui);

    const validation = this.validateCuiFormat(cleaned);
    if (!validation.valid) {
      return null;
    }

    return cleaned;
  }
}

export const anafValidationService = new AnafValidationService();
