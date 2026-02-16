import { WarehouseInfoDto } from '../dtos/smartbill.dtos';

export interface ISmartBillApiClientWarehouses {
  getWarehouses(): Promise<Array<{
    id: string;
    name: string;
  }>>;
}

export class GetWarehousesUseCase {
  constructor(private readonly apiClient: ISmartBillApiClientWarehouses) { }

  async execute(): Promise<WarehouseInfoDto[]> {
    const warehouses = await this.apiClient.getWarehouses();
    return warehouses.map((w) => ({
      warehouseId: w.id,
      warehouseName: w.name,
    }));
  }
}
