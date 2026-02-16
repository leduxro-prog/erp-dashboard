export interface SkuMapping {
  id: number;
  supplierId: number;
  supplierSku: string;
  internalProductId: number;
  internalSku: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class SkuMappingEntity implements SkuMapping {
  id!: number;
  supplierId!: number;
  supplierSku!: string;
  internalProductId!: number;
  internalSku!: string;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(data: SkuMapping) {
    Object.assign(this, data);
  }

  getCompositeKey(): string {
    return `${this.supplierId}:${this.supplierSku}`;
  }

  isValid(): boolean {
    return (
      this.supplierId > 0 &&
      this.internalProductId > 0 &&
      this.supplierSku.trim().length > 0 &&
      this.internalSku.trim().length > 0
    );
  }

  toggle(): void {
    this.isActive = !this.isActive;
  }

  getDisplayName(): string {
    return `${this.supplierSku} → ${this.internalSku} (Product: ${this.internalProductId})`;
  }
}
