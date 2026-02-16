import { SyncItem, SyncType } from '../entities/SyncItem';

export class SyncPriorityService {
  private readonly priorityMap: Record<SyncType, number> = {
    price: 1,      // Highest priority - SLA 2 minutes
    stock: 2,      // High priority - SLA 5 minutes
    product: 3,    // Medium priority - SLA 15 minutes
    category: 4,   // Lower priority
    image: 5,      // Lowest priority
  };

  getPriority(syncType: SyncType): number {
    return this.priorityMap[syncType] ?? 999;
  }

  sortByPriority(items: SyncItem[]): SyncItem[] {
    return [...items].sort((a, b) => {
      const priorityA = this.getPriority(a.syncType);
      const priorityB = this.getPriority(b.syncType);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Secondary sort: earlier createdAt comes first
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  getSlaBoundary(syncType: SyncType): number {
    // Returns SLA in minutes
    switch (syncType) {
      case 'price':
        return 2;
      case 'stock':
        return 5;
      case 'product':
        return 15;
      case 'category':
        return 30;
      case 'image':
        return 60;
      default:
        return 60;
    }
  }

  isBreachingSla(item: SyncItem): boolean {
    if (item.status === 'completed') {
      return false;
    }

    const slaBoundary = this.getSlaBoundary(item.syncType);
    const createdAtMinutesAgo =
      (new Date().getTime() - item.createdAt.getTime()) / 1000 / 60;

    return createdAtMinutesAgo > slaBoundary;
  }

  groupByPriority(items: SyncItem[]): Map<number, SyncItem[]> {
    const grouped = new Map<number, SyncItem[]>();

    for (const item of items) {
      const priority = this.getPriority(item.syncType);
      if (!grouped.has(priority)) {
        grouped.set(priority, []);
      }
      grouped.get(priority)!.push(item);
    }

    return grouped;
  }
}
