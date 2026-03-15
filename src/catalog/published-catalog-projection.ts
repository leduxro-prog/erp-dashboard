export type LifecycleState = 'draft' | 'published' | 'withdrawn';
export type EventType =
  | 'catalog.product.upsert-partial'
  | 'catalog.product.upsert-full'
  | 'catalog.product.withdraw';

export interface ProjectionVisibility {
  retail: boolean;
  b2b: boolean;
}

export interface ProjectionDimensions {
  length?: number;
  width?: number;
  height?: number;
  unit?: string;
}

export interface ProjectionTechnical {
  lumens?: number;
  kelvin?: number;
  cri?: number;
  ipRating?: string;
  wattage?: number;
  voltage?: string;
  mountingType?: string;
  dimensions?: ProjectionDimensions;
  ean?: string;
  supplierCodes?: string[];
  manufacturerCodes?: string[];
  complianceFlags?: string[];
}

export interface ProjectionMediaItem {
  url: string;
  checksum?: string;
  mimeType?: string;
}

export interface ProjectionMedia {
  primaryImage: ProjectionMediaItem | null;
  gallery: ProjectionMediaItem[];
}

export interface ProjectionDocumentRef {
  url: string;
  documentType: string;
  checksum?: string;
  mimeType?: string;
}

export interface ProjectionDocuments {
  datasheets: ProjectionDocumentRef[];
  certificates: ProjectionDocumentRef[];
  installation: ProjectionDocumentRef[];
  warranty: ProjectionDocumentRef[];
  compliance: ProjectionDocumentRef[];
}

export interface ProjectionCommercial {
  currency?: string;
  listPrice?: number;
  promoPrice?: number;
  priceRulesVersion?: number;
  stock?: {
    available?: number;
    backorderable?: boolean;
  };
}

export interface ProjectionPublishState {
  retail?: boolean;
  b2b?: boolean;
}

export interface PublishedCatalogProjection {
  productId: string;
  sku: string;
  erpProductId: string;
  sourceVersion: number;
  projectionVersion: number;
  lifecycleState: LifecycleState;
  visibility: ProjectionVisibility;
  publishState?: ProjectionPublishState;
  technical: ProjectionTechnical;
  media: ProjectionMedia;
  documents: ProjectionDocuments;
  commercial?: ProjectionCommercial;
  assortment?: {
    retailCollections?: string[];
    b2bSegments?: string[];
  };
}

export interface PublicationEventSource {
  system: 'erp';
  sourceVersion: number;
}

export interface PublicationEvent {
  eventVersion: '1.0';
  eventType: EventType;
  idempotencyKey: string;
  occurredAt: string;
  source: PublicationEventSource;
  payload: Partial<PublishedCatalogProjection> & { changedPaths?: string[] };
}

export type ProjectionTrigger = 'search-reindex' | 'media-document-refresh';

export interface ApplyPublicationEventResult {
  projection: PublishedCatalogProjection | null;
  applied: boolean;
  reason: 'stale-event' | 'withdraw' | 'full-upsert' | 'partial-upsert';
  triggers: ProjectionTrigger[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge<T extends Record<string, unknown>>(target: T, patch: Partial<T>): T {
  if (!isObject(patch)) {
    return patch as T;
  }

  const out: Record<string, unknown> = isObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (isObject(value)) {
      out[key] = deepMerge(
        (out[key] as Record<string, unknown>) ?? {},
        value as Record<string, unknown>,
      );
      continue;
    }
    out[key] = value;
  }
  return out as T;
}

function isStaleEvent(
  currentProjection: PublishedCatalogProjection | null,
  incomingSourceVersion: number,
): boolean {
  const currentVersion = Number(currentProjection?.sourceVersion ?? 0);
  const nextVersion = Number(incomingSourceVersion ?? 0);
  return nextVersion <= currentVersion;
}

export function deriveTriggers(changedPaths: string[]): ProjectionTrigger[] {
  const paths = Array.isArray(changedPaths) ? changedPaths : [];
  const out = new Set<ProjectionTrigger>();

  if (paths.length === 0) {
    out.add('search-reindex');
  }

  for (const path of paths) {
    const normalized = String(path ?? '').toLowerCase();
    if (
      normalized.startsWith('technical.') ||
      normalized.startsWith('commercial.') ||
      normalized.startsWith('visibility.')
    ) {
      out.add('search-reindex');
    }
    if (normalized.startsWith('media.') || normalized.startsWith('documents.')) {
      out.add('media-document-refresh');
    }
  }

  return Array.from(out);
}

export function applyPublicationEvent(
  currentProjection: PublishedCatalogProjection | null,
  event: {
    eventType: string;
    source: { sourceVersion: number };
    payload: Record<string, unknown>;
  },
): ApplyPublicationEventResult {
  const eventType = event?.eventType;
  const payload = event?.payload ?? {};
  const sourceVersion = Number(event?.source?.sourceVersion ?? 0);

  if (!eventType || !sourceVersion) {
    throw new Error('Invalid publication event');
  }

  if (isStaleEvent(currentProjection, sourceVersion)) {
    return {
      projection: currentProjection,
      applied: false,
      reason: 'stale-event',
      triggers: [],
    };
  }

  if (eventType === 'catalog.product.withdraw') {
    const next = deepMerge(
      (currentProjection ?? {}) as Record<string, unknown>,
      payload,
    ) as unknown as PublishedCatalogProjection;
    next.sourceVersion = sourceVersion;
    next.lifecycleState = 'withdrawn';
    next.visibility = { retail: false, b2b: false };
    return {
      projection: next,
      applied: true,
      reason: 'withdraw',
      triggers: ['search-reindex'],
    };
  }

  if (eventType === 'catalog.product.upsert-full') {
    const next = {
      ...payload,
      sourceVersion,
    } as unknown as PublishedCatalogProjection;
    return {
      projection: next,
      applied: true,
      reason: 'full-upsert',
      triggers: deriveTriggers((payload.changedPaths as string[]) ?? []),
    };
  }

  if (eventType === 'catalog.product.upsert-partial') {
    const merged = deepMerge(
      (currentProjection ?? {}) as Record<string, unknown>,
      payload,
    ) as unknown as PublishedCatalogProjection;
    merged.sourceVersion = sourceVersion;
    return {
      projection: merged,
      applied: true,
      reason: 'partial-upsert',
      triggers: deriveTriggers((payload.changedPaths as string[]) ?? []),
    };
  }

  throw new Error(`Unsupported event type: ${eventType}`);
}
