/**
 * Conversion Tracking Service
 * Enterprise service for tracking TikTok conversions via Events API.
 * 
 * Features:
 * - Server-side conversion tracking
 * - Event deduplication
 * - PII hashing
 * - Integration with orders module
 */

import { DataSource, Repository } from 'typeorm';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';
import { TikTokMarketingClient, TikTokEvent } from '../../infrastructure/api-clients/TikTokMarketingClient';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('tiktok-conversions');

export enum ConversionEventType {
    PAGE_VIEW = 'ViewContent',
    ADD_TO_CART = 'AddToCart',
    INITIATE_CHECKOUT = 'InitiateCheckout',
    COMPLETE_PAYMENT = 'CompletePayment',
    SIGN_UP = 'CompleteRegistration',
}

@Entity('tiktok_conversion_events')
@Index(['event_type', 'created_at'])
@Index(['order_id'])
@Index(['event_id'], { unique: true })
export class TikTokConversionEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 100 })
    event_id!: string;

    @Column({ type: 'enum', enum: ConversionEventType })
    event_type!: ConversionEventType;

    @Column({ type: 'varchar', length: 100, nullable: true })
    order_id!: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    product_id!: string | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    value!: number | null;

    @Column({ type: 'varchar', length: 3, default: 'EUR' })
    currency!: string;

    @Column({ type: 'boolean', default: false })
    sent_to_tiktok!: boolean;

    @Column({ type: 'boolean', default: false })
    acknowledged!: boolean;

    @Column({ type: 'text', nullable: true })
    error_message!: string | null;

    @Column({ type: 'integer', default: 0 })
    retry_count!: number;

    @CreateDateColumn()
    created_at!: Date;
}

export interface ConversionEventInput {
    eventType: ConversionEventType;
    orderId?: string;
    productId?: string;
    value?: number;
    currency?: string;
    userEmail?: string;
    userPhone?: string;
    userId?: string;
    userIp?: string;
    userAgent?: string;
}

export class ConversionTrackingService {
    private conversionRepo: Repository<TikTokConversionEntity>;
    private readonly MAX_RETRIES = 3;

    constructor(
        private dataSource: DataSource,
        private tiktokClient: TikTokMarketingClient
    ) {
        this.conversionRepo = dataSource.getRepository(TikTokConversionEntity);
    }

    /**
     * Generate unique event ID for deduplication.
     */
    private generateEventId(input: ConversionEventInput): string {
        const parts = [
            input.eventType,
            input.orderId || input.productId || 'unknown',
            Date.now().toString(),
            Math.random().toString(36).substring(2, 8),
        ];
        return parts.join('_');
    }

    /**
     * Track a conversion event.
     */
    async trackEvent(input: ConversionEventInput): Promise<{ success: boolean; eventId: string }> {
        const eventId = this.generateEventId(input);

        // Save to database first
        const conversion = this.conversionRepo.create({
            event_id: eventId,
            event_type: input.eventType,
            order_id: input.orderId || null,
            product_id: input.productId || null,
            value: input.value || null,
            currency: input.currency || 'EUR',
            sent_to_tiktok: false,
        });

        await this.conversionRepo.save(conversion);

        // Send to TikTok
        try {
            const tiktokEvent: TikTokEvent = {
                eventName: input.eventType,
                eventTime: Math.floor(Date.now() / 1000),
                eventId,
                user: {
                    email: input.userEmail,
                    phone: input.userPhone,
                    externalId: input.userId,
                    ip: input.userIp,
                    userAgent: input.userAgent,
                },
                properties: {
                    currency: input.currency || 'EUR',
                    value: input.value,
                    contentId: input.productId,
                },
            };

            const result = await this.tiktokClient.trackEvent(tiktokEvent);

            if (result.success) {
                await this.conversionRepo.update(conversion.id, {
                    sent_to_tiktok: true,
                    acknowledged: true,
                });

                logger.info('Conversion tracked', {
                    eventId,
                    eventType: input.eventType,
                    value: input.value,
                });

                return { success: true, eventId };
            } else {
                await this.conversionRepo.update(conversion.id, {
                    retry_count: 1,
                    error_message: 'TikTok API returned failure',
                });

                return { success: false, eventId };
            }
        } catch (error: any) {
            await this.conversionRepo.update(conversion.id, {
                retry_count: 1,
                error_message: error.message,
            });

            logger.error('Failed to track conversion', { eventId, error: error.message });
            return { success: false, eventId };
        }
    }

    /**
     * Track purchase conversion from order.
     */
    async trackPurchase(
        orderId: string,
        totalValue: number,
        currency: string,
        userEmail?: string,
        userPhone?: string,
        userId?: string
    ): Promise<{ success: boolean; eventId: string }> {
        return this.trackEvent({
            eventType: ConversionEventType.COMPLETE_PAYMENT,
            orderId,
            value: totalValue,
            currency,
            userEmail,
            userPhone,
            userId,
        });
    }

    /**
     * Track add to cart event.
     */
    async trackAddToCart(
        productId: string,
        value: number,
        userEmail?: string,
        userId?: string
    ): Promise<{ success: boolean; eventId: string }> {
        return this.trackEvent({
            eventType: ConversionEventType.ADD_TO_CART,
            productId,
            value,
            userEmail,
            userId,
        });
    }

    /**
     * Retry failed conversions.
     */
    async retryFailedConversions(): Promise<{ retried: number; successful: number }> {
        const failed = await this.conversionRepo.find({
            where: {
                sent_to_tiktok: false,
            },
        });

        const toRetry = failed.filter(f => f.retry_count < this.MAX_RETRIES);

        let successful = 0;

        for (const conversion of toRetry) {
            try {
                const tiktokEvent: TikTokEvent = {
                    eventName: conversion.event_type,
                    eventTime: Math.floor(conversion.created_at.getTime() / 1000),
                    eventId: conversion.event_id,
                    user: {},
                    properties: {
                        currency: conversion.currency,
                        value: conversion.value || undefined,
                        contentId: conversion.product_id || undefined,
                    },
                };

                const result = await this.tiktokClient.trackEvent(tiktokEvent);

                if (result.success) {
                    await this.conversionRepo.update(conversion.id, {
                        sent_to_tiktok: true,
                        acknowledged: true,
                    });
                    successful++;
                } else {
                    await this.conversionRepo.update(conversion.id, {
                        retry_count: conversion.retry_count + 1,
                    });
                }
            } catch (error: any) {
                await this.conversionRepo.update(conversion.id, {
                    retry_count: conversion.retry_count + 1,
                    error_message: error.message,
                });
            }
        }

        logger.info('Retry completed', { retried: toRetry.length, successful });

        return { retried: toRetry.length, successful };
    }

    /**
     * Get conversion summary for reporting.
     */
    async getConversionSummary(
        startDate: Date,
        endDate: Date
    ): Promise<{
        totalEvents: number;
        byType: Record<string, number>;
        totalValue: number;
        successRate: number;
    }> {
        const conversions = await this.conversionRepo
            .createQueryBuilder('c')
            .where('c.created_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getMany();

        const byType: Record<string, number> = {};
        let totalValue = 0;
        let sentCount = 0;

        for (const c of conversions) {
            byType[c.event_type] = (byType[c.event_type] || 0) + 1;
            totalValue += c.value || 0;
            if (c.sent_to_tiktok) sentCount++;
        }

        return {
            totalEvents: conversions.length,
            byType,
            totalValue,
            successRate: conversions.length > 0 ? (sentCount / conversions.length) * 100 : 0,
        };
    }
}
