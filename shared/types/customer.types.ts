// =============================================================================
// Legacy customer types (used by existing modules)
// =============================================================================

export enum CustomerTypeEnum {
  INDIVIDUAL = 'individual',
  BUSINESS = 'business',
}

export type CustomerType = CustomerTypeEnum;

export enum CustomerStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export type CustomerStatus = CustomerStatusEnum;

export enum B2BRegistrationStatusEnum {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export type B2BRegistrationStatus = B2BRegistrationStatusEnum;

export type CustomerTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CreditLimit {
  amount: number;
  currency: string;
  used: number;
  available: number;
}

export interface Customer {
  id: number;
  companyName: string;
  type: CustomerType;
  status: CustomerStatus;
  email?: string;
  phone?: string;
  taxIdentificationNumber?: string;
  registrationNumber?: string;
  creditLimit?: CreditLimit;
  tier?: CustomerTier;
  createdAt: Date;
  updatedAt: Date;
}

export interface B2BRegistration {
  id: number;
  companyName: string;
  email: string;
  phone?: string;
  cui?: string;
  status: B2BRegistrationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerDTO {
  companyName: string;
  type?: CustomerType;
  email?: string;
  phone?: string;
  taxIdentificationNumber?: string;
  registrationNumber?: string;
}

export interface UpdateCustomerDTO {
  companyName?: string;
  type?: CustomerType;
  status?: CustomerStatus;
  email?: string;
  phone?: string;
  taxIdentificationNumber?: string;
  registrationNumber?: string;
}

export interface CreateB2BRegistrationDTO {
  companyName: string;
  email: string;
  phone?: string;
  cui?: string;
}

// =============================================================================
// Unified customer types (WS2: unified customer search)
// =============================================================================

export type CustomerSource = 'erp' | 'b2b' | 'smartbill';

export interface UnifiedCustomerDTO {
  id: string;
  display_name: string;
  company_name?: string;
  cui?: string;
  email?: string;
  phone?: string;
  source: CustomerSource;
  external_id?: string;
  credit_limit?: number;
  credit_used?: number;
  discount_percentage?: number;
  tier?: string;
  address?: string;
}

export interface CustomerSearchQuery {
  q: string;
  sources?: CustomerSource[];
  limit?: number;
}
