import { Warehouse } from '../entities/Warehouse';
import { StockItem } from '../entities/StockItem';

export interface LocationInfo {
  city?: string;
  region?: string;
  postalCode?: string;
}

/**
 * Geographic Routing Service
 * Logic to determine the best warehouse for a fulfillment based on geography and stock.
 */
export class GeographicRoutingService {
  /**
   * Determine the best warehouse for a product based on customer location and stock levels.
   * 
   * Priority:
   * 1. Region match + available stock
   * 2. Highest warehouse priority (lowest number) + available stock
   * 3. Main warehouse (fallback)
   */
  public findBestWarehouse(
    location: LocationInfo,
    warehouses: Warehouse[],
    stockItems: StockItem[]
  ): string {
    const activeWarehouses = warehouses.filter(w => w.getIsActive());
    
    // Filter stock items that actually have availability for the product
    const availableWhIds = new Set(
      stockItems
        .filter(si => si.getAvailableQuantity() > 0)
        .map(si => si.warehouse_id)
    );

    const candidateWarehouses = activeWarehouses.filter(w => availableWhIds.has(w.getId()));

    if (candidateWarehouses.length === 0) {
      // Fallback to main warehouse even if out of stock (will handle via backorder)
      const mainWh = activeWarehouses.find(w => w.isMainWarehouse());
      return mainWh ? mainWh.getId() : activeWarehouses[0].getId();
    }

    // 1. Try to find match by Region
    if (location.region) {
      const regionMatch = candidateWarehouses.find(
        w => w.getRegion()?.toLowerCase() === location.region?.toLowerCase()
      );
      if (regionMatch) return regionMatch.getId();
    }

    // 2. Try to find match by City
    if (location.city) {
      const cityMatch = candidateWarehouses.find(
        w => w.getCity()?.toLowerCase() === location.city?.toLowerCase()
      );
      if (cityMatch) cityMatch.getId();
    }

    // 3. Fallback to priority (lowest priority number is highest priority)
    const sortedByPriority = [...candidateWarehouses].sort(
      (a, b) => a.getPriority() - b.getPriority()
    );

    return sortedByPriority[0].getId();
  }
}
