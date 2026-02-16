import { CustomerTier } from '../entities/CustomerTier';

export interface ITierRepository {
  getTierByCustomerId(customerId: number): Promise<CustomerTier | null>;
}
