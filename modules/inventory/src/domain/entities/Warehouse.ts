export type WarehouseCode = 'magazin' | 'ddepozit' | 'cantitativ';

export interface WarehouseProps {
  id: string;
  name: string;
  code: WarehouseCode;
  priority: number;
  isActive: boolean;
  city?: string;
  region?: string;
  postalCode?: string;
  smartBillId?: string;
}

export class Warehouse {
  private readonly id: string;
  private readonly name: string;
  private readonly code: WarehouseCode;
  private readonly priority: number;
  private isActive: boolean;
  private readonly city?: string;
  private readonly region?: string;
  private readonly postalCode?: string;
  private readonly smartBillId?: string;

  constructor(props: WarehouseProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Warehouse id is required');
    }

    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Warehouse name is required');
    }

    this.id = props.id;
    this.name = props.name;
    this.code = props.code;
    this.priority = props.priority;
    this.isActive = props.isActive;
    this.city = props.city;
    this.region = props.region;
    this.postalCode = props.postalCode;
    this.smartBillId = props.smartBillId;
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getCode(): WarehouseCode {
    return this.code;
  }

  getPriority(): number {
    return this.priority;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  getCity(): string | undefined {
    return this.city;
  }

  getRegion(): string | undefined {
    return this.region;
  }

  getPostalCode(): string | undefined {
    return this.postalCode;
  }

  getSmartBillId(): string | undefined {
    return this.smartBillId;
  }

  isMainWarehouse(): boolean {
    return this.code === 'magazin';
  }

  setActive(isActive: boolean): void {
    this.isActive = isActive;
  }

  static getDefaultWarehouses(): Warehouse[] {
    return [
      new Warehouse({
        id: 'wh-magazin-001',
        name: 'Magazin Central',
        code: 'magazin',
        priority: 1,
        isActive: true,
        city: 'Bucuresti',
        region: 'B',
        smartBillId: 'sb-magazin-001',
      }),
      new Warehouse({
        id: 'wh-ddepozit-002',
        name: 'Depozit Voluntari',
        code: 'ddepozit',
        priority: 2,
        isActive: true,
        city: 'Voluntari',
        region: 'IF',
        smartBillId: 'sb-ddepozit-002',
      }),
      new Warehouse({
        id: 'wh-cantitativ-003',
        name: 'Cantitativ',
        code: 'cantitativ',
        priority: 3,
        isActive: true,
        city: 'Bucuresti',
        region: 'B',
        smartBillId: 'sb-cantitativ-003',
      }),
    ];
  }
}
