/**
 * @file Event Module Entry Point
 * @module events
 * @description Main entry point for the events module, exporting all types,
 * schemas, and the schema registry.
 */

// Types
export {
  EventEnvelope,
  EventEnvelopeFactory,
  EventEnvelopeUtils,
  EventPriority,
  EventMetadata,
  EventEnvelopeOptions,
  ValidationResult,
  isEventEnvelope,
  isEventPriority,
} from './types/EventEnvelope';

// Registry
import type { SchemaRegistry } from './registry';
import { getSchemaRegistry } from './registry';

export {
  SchemaRegistry,
  SchemaInfo,
  SchemaRegistryOptions,
  RegistryJson,
  EventTypeKey,
  createSchemaRegistry,
  getSchemaRegistry,
} from './registry';

// Re-export AJV types
export type { ErrorObject, ValidateFunction } from 'ajv';

/**
 * Initialize the event module
 *
 * This is a convenience function to initialize the schema registry
 * with default settings.
 *
 * @returns Promise that resolves when the registry is initialized
 *
 * @example
 * ```typescript
 * import { initializeEvents, EventEnvelopeFactory } from '@cypher/events';
 *
 * await initializeEvents();
 *
 * const envelope = EventEnvelopeFactory.create({
 *   event_type: 'order.created',
 *   producer: 'order-service',
 *   payload: { order_id: '123' }
 * });
 * ```
 */
export async function initializeEvents(options?: {
  schemasDir?: string;
  registryPath?: string;
}): Promise<SchemaRegistry> {
  const registry = getSchemaRegistry(options);
  await registry.initialize();
  return registry;
}
