/**
 * Customer Port Interface
 * Inbound port for querying customer data from other modules
 *
 * @module Application/Ports
 */

import { AudienceFilter } from '../../domain/entities/Campaign';

/**
 * Customer data model
 */
export interface Customer {
  id: string;
  email: string;
  tier: string;
  totalSpent: number;
  lastOrderDate: Date | null;
  purchasedCategories: string[];
  tags: string[];
  registrationDate: Date;
}

/**
 * ICustomerPort
 * Port interface for querying customer data
 * Implemented by customer/orders module
 */
export interface ICustomerPort {
  /**
   * Find customers matching filter criteria
   * @param filter - Audience filter criteria
   * @returns Array of matching customer IDs
   */
  findByFilter(filter: AudienceFilter): Promise<string[]>;

  /**
   * Find customer by ID
   * @param customerId - Customer ID
   * @returns Customer data or null if not found
   */
  findById(customerId: string): Promise<Customer | null>;

  /**
   * Get all customers for segmentation
   * @returns All customer segment data
   */
  getAllForSegmentation(): Promise<Array<{
    customerId: string;
    tier: string;
    totalSpent: number;
    lastOrderDate: Date | null;
    purchasedCategories: string[];
    tags: string[];
    registrationDate: Date;
  }>>;
}
