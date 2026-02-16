/**
 * Customer Port Interface
 *
 * Defines the contract for querying customer data.
 * Implementation is provided by the customer module.
 *
 * @module whatsapp/domain/ports
 */

/**
 * Customer domain object (minimal interface).
 * Only includes fields needed for WhatsApp module.
 */
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BANNED';
  type: 'B2B' | 'B2C';
  language: string;
}

/**
 * Customer Port Interface.
 *
 * Port for querying customer information from the customer domain.
 * Encapsulates inter-module communication.
 *
 * @interface ICustomerPort
 */
export interface ICustomerPort {
  /**
   * Find a customer by phone number.
   * Phone should be in E.164 format.
   *
   * @param phone - Phone number in E.164 format
   * @returns Promise resolving to customer or null if not found
   * @throws {Error} On database or service errors
   */
  findByPhone(phone: string): Promise<Customer | null>;

  /**
   * Find a customer by ID.
   *
   * @param id - Customer ID
   * @returns Promise resolving to customer or null if not found
   * @throws {Error} On database or service errors
   */
  findById(id: string): Promise<Customer | null>;

  /**
   * Find a customer by email.
   *
   * @param email - Customer email
   * @returns Promise resolving to customer or null if not found
   * @throws {Error} On database or service errors
   */
  findByEmail(email: string): Promise<Customer | null>;
}
