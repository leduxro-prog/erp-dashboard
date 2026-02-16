import { DashboardWidget, WidgetPosition } from './DashboardWidget';

/**
 * Dashboard Entity
 *
 * Represents a customizable analytics dashboard that contains multiple widgets.
 * Dashboards allow users to monitor business metrics and KPIs in a centralized location.
 *
 * Features:
 * - Multiple pre-built dashboards (sales, inventory, customers, financial)
 * - Custom dashboards created by users
 * - Shared dashboards (visible to multiple users)
 * - Global filters (date range, customer tier) applied to all widgets
 * - Configurable layout (grid-based or freeform)
 * - Full CRUD operations
 *
 * @class Dashboard
 */
export class Dashboard {
  /**
   * Unique identifier for this dashboard
   */
  public id: string;

  /**
   * Dashboard name (displayed to users)
   */
  public name: string;

  /**
   * Optional description of dashboard purpose
   */
  public description: string;

  /**
   * User ID who owns this dashboard
   */
  public ownerId: string;

  /**
   * Whether this is the user's default/home dashboard
   */
  public isDefault: boolean;

  /**
   * Whether this dashboard is shared with other users
   */
  public isShared: boolean;

  /**
   * Dashboard layout type
   */
  public layout: LayoutType;

  /**
   * Widgets on this dashboard
   */
  public widgets: DashboardWidget[];

  /**
   * Global filters applied to all widgets
   */
  public filters: DashboardFilters;

  /**
   * When this dashboard was created
   */
  public createdAt: Date;

  /**
   * When this dashboard was last updated
   */
  public updatedAt: Date;

  /**
   * Create a new Dashboard
   */
  constructor(
    id: string,
    name: string,
    description: string,
    ownerId: string,
    isDefault: boolean = false,
    isShared: boolean = false,
    layout: LayoutType = LayoutType.GRID,
    widgets: DashboardWidget[] = [],
    filters: DashboardFilters = {},
    createdAt: Date = new Date(),
    updatedAt: Date = new Date()
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.ownerId = ownerId;
    this.isDefault = isDefault;
    this.isShared = isShared;
    this.layout = layout;
    this.widgets = widgets;
    this.filters = filters;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /**
   * Add a widget to this dashboard
   *
   * @param widget - Widget to add
   * @throws Error if widget with same ID already exists
   */
  public addWidget(widget: DashboardWidget): void {
    if (this.widgets.some((w) => w.id === widget.id)) {
      throw new Error(`Widget with id ${widget.id} already exists on this dashboard`);
    }
    this.widgets.push(widget);
    this.updatedAt = new Date();
  }

  /**
   * Remove a widget from this dashboard by ID
   *
   * @param widgetId - ID of widget to remove
   * @returns true if widget was removed, false if not found
   */
  public removeWidget(widgetId: string): boolean {
    const initialLength = this.widgets.length;
    this.widgets = this.widgets.filter((w) => w.id !== widgetId);

    if (this.widgets.length < initialLength) {
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Reorder widgets on the dashboard by updating their positions
   *
   * @param positions - Map of widget ID to new position
   * @throws Error if position widget IDs don't match dashboard widgets
   */
  public reorderWidgets(positions: Record<string, WidgetPosition>): void {
    for (const [widgetId, newPosition] of Object.entries(positions)) {
      const widget = this.widgets.find((w) => w.id === widgetId);
      if (!widget) {
        throw new Error(`Widget with id ${widgetId} not found on this dashboard`);
      }
      widget.position = newPosition;
    }
    this.updatedAt = new Date();
  }

  /**
   * Create a copy of this dashboard with a new ID and owner
   * Includes all widgets but not the shared status
   *
   * @param newId - ID for the duplicated dashboard
   * @param newOwnerId - Owner ID for the duplicate
   * @param newName - Name for the duplicate (default: "{original} (Copy)")
   * @returns New dashboard instance
   */
  public duplicate(newId: string, newOwnerId: string, newName?: string): Dashboard {
    const duplicatedWidgets = this.widgets.map(
      (widget) =>
        new DashboardWidget(
          `${widget.id}_copy_${Date.now()}`,
          newId,
          widget.type,
          widget.title,
          widget.dataSourceType,
          widget.query,
          { ...widget.position },
          widget.refreshInterval,
          widget.cachedData,
          widget.lastRefreshedAt
        )
    );

    return new Dashboard(
      newId,
      newName || `${this.name} (Copy)`,
      this.description,
      newOwnerId,
      false,
      false,
      this.layout,
      duplicatedWidgets,
      { ...this.filters }
    );
  }

  /**
   * Export dashboard configuration (for sharing or backup)
   * Returns a serializable object
   *
   * @returns Dashboard configuration as plain object
   */
  public export(): DashboardExportData {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      layout: this.layout,
      filters: this.filters,
      widgets: this.widgets.map((w) => w.serialize()),
      exportedAt: new Date(),
    };
  }
}

/**
 * Dashboard layout type enumeration
 */
export enum LayoutType {
  GRID = 'GRID',
  FREEFORM = 'FREEFORM',
}

/**
 * Global filters applied to all dashboard widgets
 */
export interface DashboardFilters {
  /** Global date range filter */
  dateRange?: {
    startDate: Date | string;
    endDate: Date | string;
  };

  /** Customer tier filter (e.g., GOLD, SILVER, BRONZE) */
  customerTier?: string;

  /** Region filter */
  region?: string;

  /** Product category filter */
  productCategory?: string;

  /** Additional custom filters */
  [key: string]: unknown;
}

/**
 * Dashboard data for export (backup/sharing)
 */
export interface DashboardExportData {
  id: string;
  name: string;
  description: string;
  layout: LayoutType;
  filters: DashboardFilters;
  widgets: unknown[];
  exportedAt: Date;
}

/**
 * Dashboard data transfer object (for API responses)
 */
export type DashboardDTO = Omit<Dashboard, 'addWidget' | 'removeWidget' | 'reorderWidgets' | 'duplicate' | 'export'>;
