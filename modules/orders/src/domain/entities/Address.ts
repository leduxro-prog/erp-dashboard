/**
 * Address Value Object
 * Used for billing and shipping addresses
 */
export class Address {
  readonly name: string;
  readonly street: string;
  readonly city: string;
  readonly county: string;
  readonly postalCode: string;
  readonly country: string;
  readonly phone?: string;

  constructor(props: {
    name: string;
    street: string;
    city: string;
    county: string;
    postalCode: string;
    country?: string;
    phone?: string;
  }) {
    this.name = props.name;
    this.street = props.street;
    this.city = props.city;
    this.county = props.county;
    this.postalCode = props.postalCode;
    this.country = props.country || 'Romania';
    this.phone = props.phone;

    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Address name is required');
    }
    if (!this.street || this.street.trim().length === 0) {
      throw new Error('Address street is required');
    }
    if (!this.city || this.city.trim().length === 0) {
      throw new Error('Address city is required');
    }
    if (!this.county || this.county.trim().length === 0) {
      throw new Error('Address county is required');
    }
    if (!this.postalCode || this.postalCode.trim().length === 0) {
      throw new Error('Address postal code is required');
    }
  }

  static create(props: {
    name: string;
    street: string;
    city: string;
    county: string;
    postalCode: string;
    country?: string;
    phone?: string;
  }): Address {
    return new Address(props);
  }

  toJSON() {
    return {
      name: this.name,
      street: this.street,
      city: this.city,
      county: this.county,
      postalCode: this.postalCode,
      country: this.country,
      phone: this.phone,
    };
  }
}
