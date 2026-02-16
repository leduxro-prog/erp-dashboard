export type WarehouseCode = 'magazin' | 'ddepozit' | 'cantitativ';

export interface WarehouseProps {
  id: string;
  name: string;
  code: WarehouseCode;
  priority: 1 | 2 | 3;
  isActive: boolean;
  smartBillId?: string;
}

export class Warehouse {
  private readonly id: string;
  private readonly name: string;
  private readonly code: WarehouseCode;
  private readonly priority: 1 | 2 | 3;
  private isActive: boolean;
  private readonly smartBillId?: string;

  constructor(props: WarehouseProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error('Warehouse id is required');
    }

    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Warehouse name is required');
    }

    if (![1, 2, 3].includes(props.priority)) {
      throw new Error('Priority must be 1, 2, or 3');
    }

    this.id = props.id;
    this.name = props.name;
    this.code = props.code;
    this.priority = props.priority;
    this.isActive = props.isActive;
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

  getPriority(): 1 | 2 | 3 {
    return this.priority;
  }

  getIsActive(): boolean {
    return this.isActive;
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
        name: 'Magazin',
        code: 'magazin',
        priority: 1,
        isActive: true,
        smartBillId: 'sb-magazin-001',
      }),
      new Warehouse({
        id: 'wh-ddepozit-002',
        name: 'ddepozit',
        code: 'ddepozit',
        priority: 2,
        isActive: true,
        smartBillId: 'sb-ddepozit-002',
      }),
      new Warehouse({
        id: 'wh-cantitativ-003',
        name: 'cantitativ',
        code: 'cantitativ',
        priority: 3,
        isActive: true,
        smartBillId: 'sb-cantitativ-003',
      }),
    ];
  }
}
