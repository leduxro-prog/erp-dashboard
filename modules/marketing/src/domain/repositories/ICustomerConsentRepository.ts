/**
 * ICustomerConsentRepository
 * Port interface for customer consent persistence operations
 */
import { CustomerConsent } from '../entities/CustomerConsent';

export interface ICustomerConsentRepository {
  save(consent: CustomerConsent): Promise<CustomerConsent>;
  findByCustomerAndChannel(customerId: string, channel: string): Promise<CustomerConsent | null>;
  findByCustomer(customerId: string): Promise<CustomerConsent[]>;
  findOptedIn(channel: string): Promise<CustomerConsent[]>;
  isOptedIn(customerId: string, channel: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  count(filter: { channel?: string; isOptedIn?: boolean }): Promise<number>;
}
