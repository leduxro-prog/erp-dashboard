/**
 * CUI Validation Service
 * Validates Romanian CUI (Cod Unic de Înregistrare) format.
 * For ANAF API verification, use AnafValidationService from infrastructure.
 *
 * @module B2B Portal - Domain Services
 */

import { InvalidCuiError } from '../errors/b2b.errors';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('cui-validation-service');

export interface CuiValidationResult {
  valid: boolean;
  error?: string;
}

export class CuiValidationService {
  validateFormat(cui: string): boolean {
    let cleaned = cui.trim().replace(/^RO/i, '');

    if (!/^\d{2,10}$/.test(cleaned)) {
      return false;
    }

    if (cleaned.length <= 2) {
      return true;
    }

    const testKey = [7, 5, 3, 2, 1, 7, 5, 3, 2];
    const digits = cleaned.split('').map(Number);
    const checkDigit = digits[digits.length - 1];

    const cuiWithoutCheck = cleaned.slice(0, -1).padStart(9, '0').split('').map(Number);

    const sum = cuiWithoutCheck.reduce((acc, digit, index) => {
      return acc + digit * testKey[index];
    }, 0);

    let calculatedCheckDigit = (sum * 10) % 11;
    if (calculatedCheckDigit === 10) {
      calculatedCheckDigit = 0;
    }

    return checkDigit === calculatedCheckDigit;
  }

  async validate(cui: string): Promise<boolean> {
    if (!this.validateFormat(cui)) {
      throw new InvalidCuiError(
        cui,
        'CUI must be 2-10 digits with valid check digit'
      );
    }

    return true;
  }

  normalize(cui: string): string | undefined {
    const cleaned = cui.trim().replace(/\s/g, '');

    if (!this.validateFormat(cleaned)) {
      return undefined;
    }

    if (cleaned.length === 2) {
      return cleaned.padStart(2, '0');
    }

    return cleaned;
  }

  getCheckDigit(cui: string): number | undefined {
    const cleaned = cui.trim();

    if (!/^\d{2,10}$/.test(cleaned)) {
      return undefined;
    }

    const digits = cleaned.split('').map(Number);
    return digits[digits.length - 1];
  }

  calculateCheckDigit(cuiWithoutCheckDigit: string): number | undefined {
    const cleaned = cuiWithoutCheckDigit.trim();

    if (!/^\d{1,9}$/.test(cleaned)) {
      return undefined;
    }

    const testKey = [7, 5, 3, 2, 1, 7, 5, 3, 2];
    const padded = cleaned.padStart(9, '0').split('').map(Number);
    const sum = padded.reduce((acc, digit, index) => {
      return acc + digit * testKey[index];
    }, 0);

    const checkDigit = (sum * 10) % 11;
    return checkDigit === 10 ? 0 : checkDigit;
  }
}
