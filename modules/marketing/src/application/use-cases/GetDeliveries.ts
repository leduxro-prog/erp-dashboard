/**
 * GetDeliveries Use-Case
 * Application use-case for retrieving campaign channel deliveries
 *
 * @module Application/UseCases
 */

import {
  IChannelDeliveryRepository,
  DeliveryFilter,
} from '../../domain/repositories/IChannelDeliveryRepository';
import { ChannelDelivery } from '../../domain/entities/ChannelDelivery';

/**
 * Input for GetDeliveries use-case
 */
export interface GetDeliveriesInput {
  /** Campaign ID to get deliveries for */
  campaignId: string;
  /** Page number (1-based) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Filter by delivery status */
  status?: string;
  /** Filter by delivery channel */
  channel?: string;
}

/**
 * Output from GetDeliveries use-case
 */
export interface GetDeliveriesOutput {
  /** Deliveries in this page */
  items: ChannelDelivery[];
  /** Total items matching filter */
  total: number;
  /** Current page */
  page: number;
  /** Total pages */
  pages: number;
}

/**
 * GetDeliveries Use-Case
 *
 * Responsibilities:
 * - Build delivery filter from input parameters
 * - Query deliveries with pagination
 * - Return paginated delivery results
 *
 * @class GetDeliveries
 */
export class GetDeliveries {
  /**
   * Create a new GetDeliveries use-case instance
   *
   * @param deliveryRepo - Channel delivery repository
   */
  constructor(private readonly deliveryRepo: IChannelDeliveryRepository) {}

  /**
   * Execute the GetDeliveries use-case
   *
   * @param input - Get deliveries input
   * @returns Paginated delivery results
   */
  async execute(input: GetDeliveriesInput): Promise<GetDeliveriesOutput> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    // Build filter from input
    const filter: DeliveryFilter = {
      campaignId: input.campaignId,
    };

    if (input.status) {
      filter.status = input.status;
    }

    if (input.channel) {
      filter.channel = input.channel;
    }

    // Query deliveries with filter and pagination
    const result = await this.deliveryRepo.findByFilter(filter, { page, limit });

    return {
      items: result.items,
      total: result.total,
      page: result.page,
      pages: result.pages,
    };
  }
}
