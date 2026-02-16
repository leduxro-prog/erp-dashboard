import {
  format,
  isAfter,
  addDays,
  differenceInDays,
  isWeekend,
  parse,
} from 'date-fns';
import { ro } from 'date-fns/locale';

/**
 * Format a date in Romanian locale (dd.MM.yyyy)
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDateRo(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return format(dateObj, 'dd.MM.yyyy', { locale: ro });
}

/**
 * Format a date and time in Romanian locale (dd.MM.yyyy HH:mm)
 * @param date - Date to format
 * @returns Formatted datetime string
 */
export function formatDateTimeRo(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return format(dateObj, 'dd.MM.yyyy HH:mm', { locale: ro });
}

/**
 * Check if a date has expired (is in the past)
 * @param date - Date to check
 * @returns true if date is in the past, false otherwise
 */
export function isExpired(date: Date | string | number): boolean {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return isAfter(new Date(), dateObj);
}

/**
 * Add business days to a date (skipping weekends)
 * @param date - Starting date
 * @param days - Number of business days to add
 * @returns New date with business days added
 */
export function addBusinessDays(date: Date, days: number): Date {
  let current = new Date(date);
  let remaining = days;

  while (remaining > 0) {
    current = addDays(current, 1);
    if (!isWeekend(current)) {
      remaining--;
    }
  }

  return current;
}

/**
 * Calculate the quote expiration date
 * @param createdAt - Quote creation date
 * @param validityDays - Number of days the quote is valid (default 15)
 * @returns Expiration date
 */
export function getQuoteExpirationDate(
  createdAt: Date | string | number,
  validityDays: number = 15
): Date {
  const createdDate = typeof createdAt === 'string' || typeof createdAt === 'number'
    ? new Date(createdAt)
    : createdAt;

  return addDays(createdDate, validityDays);
}

/**
 * Get current UTC date and time
 * @returns Current date in UTC
 */
export function nowUTC(): Date {
  return new Date();
}

/**
 * Calculate difference between two dates in days
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days between dates (positive if date2 is after date1)
 */
export function diffInDays(
  date1: Date | string | number,
  date2: Date | string | number
): number {
  const d1 = typeof date1 === 'string' || typeof date1 === 'number' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' || typeof date2 === 'number' ? new Date(date2) : date2;

  return differenceInDays(d2, d1);
}

/**
 * Parse a date string in Romanian locale format
 * @param dateString - Date string in dd.MM.yyyy format
 * @returns Parsed date object
 */
export function parseDateRo(dateString: string): Date {
  return parse(dateString, 'dd.MM.yyyy', new Date());
}

/**
 * Parse a datetime string in Romanian locale format
 * @param dateTimeString - DateTime string in dd.MM.yyyy HH:mm format
 * @returns Parsed date object
 */
export function parseDateTimeRo(dateTimeString: string): Date {
  return parse(dateTimeString, 'dd.MM.yyyy HH:mm', new Date());
}

/**
 * Get the start of the current business day
 * @returns Today's date at 00:00
 */
export function getBusinessDayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Get the end of the current business day
 * @returns Today's date at 23:59:59
 */
export function getBusinessDayEnd(): Date {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}
