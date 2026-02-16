/**
 * Content Scheduling Service
 * Manages TikTok content scheduling and tracking.
 * 
 * Features:
 * - Schedule posts for optimal times (19:30-21:00)
 * - Hashtag management
 * - Performance tracking
 * - Script template management
 */

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { DataSource, Repository } from 'typeorm';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('content-scheduling');

export enum ContentStatus {
    DRAFT = 'draft',
    SCHEDULED = 'scheduled',
    POSTED = 'posted',
    FAILED = 'failed',
}

export enum ContentType {
    VIDEO = 'video',
    IMAGE = 'image',
    CAROUSEL = 'carousel',
}

@Entity('tiktok_scheduled_content')
@Index(['scheduled_at'])
@Index(['status'])
export class TikTokContentEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255 })
    title!: string;

    @Column({ type: 'text' })
    script_text!: string;

    @Column({ type: 'enum', enum: ContentType, default: ContentType.VIDEO })
    content_type!: ContentType;

    @Column({ type: 'varchar', length: 500, nullable: true })
    media_url!: string | null;

    @Column({ type: 'jsonb', default: [] })
    hashtags!: string[];

    @Column({ type: 'varchar', length: 255, nullable: true })
    music_track!: string | null;

    @Column({ type: 'timestamp' })
    scheduled_at!: Date;

    @Column({ type: 'enum', enum: ContentStatus, default: ContentStatus.DRAFT })
    status!: ContentStatus;

    @Column({ type: 'varchar', length: 100, nullable: true })
    tiktok_post_id!: string | null;

    @Column({ type: 'integer', default: 0 })
    views!: number;

    @Column({ type: 'integer', default: 0 })
    likes!: number;

    @Column({ type: 'integer', default: 0 })
    shares!: number;

    @Column({ type: 'integer', default: 0 })
    comments!: number;

    @Column({ type: 'text', nullable: true })
    error_message!: string | null;

    @Column({ type: 'varchar', length: 100 })
    created_by!: string;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;
}

export interface ContentScheduleInput {
    title: string;
    scriptText: string;
    contentType: ContentType;
    mediaUrl?: string;
    hashtags: string[];
    musicTrack?: string;
    scheduledAt: Date;
    createdBy: string;
}

export interface OptimalTimeSlot {
    hour: number;
    minute: number;
    dayOfWeek?: number; // 0-6, optional
    reason: string;
}

export class ContentSchedulingService {
    private contentRepo: Repository<TikTokContentEntity>;

    // Optimal posting times for Romania (based on engagement data)
    private readonly OPTIMAL_SLOTS: OptimalTimeSlot[] = [
        { hour: 19, minute: 30, reason: 'Prime evening engagement window' },
        { hour: 20, minute: 0, reason: 'Peak evening activity' },
        { hour: 20, minute: 30, reason: 'High engagement period' },
        { hour: 21, minute: 0, reason: 'Secondary evening peak' },
        { hour: 12, minute: 0, reason: 'Lunch break engagement' },
        { hour: 13, minute: 0, reason: 'Early afternoon activity' },
    ];

    // Recommended hashtags for Cypher lighting products
    private readonly RECOMMENDED_HASHTAGS = [
        '#CypherLighting',
        '#MagneticTrackLight',
        '#DesignInterior2026',
        '#EfficientHome',
        '#SmartHomeRomania',
        '#LEDLighting',
        '#ModernInterior',
        '#HomeDesign',
    ];

    constructor(private dataSource: DataSource) {
        this.contentRepo = dataSource.getRepository(TikTokContentEntity);
    }

    /**
     * Schedule new content for posting.
     */
    async scheduleContent(input: ContentScheduleInput): Promise<TikTokContentEntity> {
        const content = this.contentRepo.create({
            title: input.title,
            script_text: input.scriptText,
            content_type: input.contentType,
            media_url: input.mediaUrl || null,
            hashtags: input.hashtags,
            music_track: input.musicTrack || null,
            scheduled_at: input.scheduledAt,
            status: ContentStatus.SCHEDULED,
            created_by: input.createdBy,
        });

        const saved = await this.contentRepo.save(content);

        logger.info('Content scheduled', {
            id: saved.id,
            scheduledAt: input.scheduledAt,
            hashtags: input.hashtags.length,
        });

        return saved;
    }

    /**
     * Get next optimal posting time.
     */
    getNextOptimalTime(fromDate: Date = new Date()): Date {
        const slots = [...this.OPTIMAL_SLOTS].sort((a, b) => {
            // Sort by hour and minute
            return a.hour * 60 + a.minute - (b.hour * 60 + b.minute);
        });

        const now = fromDate;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Find next available slot today
        for (const slot of slots) {
            const slotMinutes = slot.hour * 60 + slot.minute;
            if (slotMinutes > currentMinutes) {
                const nextTime = new Date(now);
                nextTime.setHours(slot.hour, slot.minute, 0, 0);
                return nextTime;
            }
        }

        // No slots left today, use first slot tomorrow
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(slots[0].hour, slots[0].minute, 0, 0);
        return tomorrow;
    }

    /**
     * Get recommended hashtags for a product category.
     */
    getRecommendedHashtags(category?: string): string[] {
        const baseHashtags = [...this.RECOMMENDED_HASHTAGS];

        if (category) {
            // Add category-specific hashtags
            const categoryHashtags: Record<string, string[]> = {
                'magnetic': ['#MagneticLighting', '#TrackLighting', '#ModularLighting'],
                'led': ['#LEDDesign', '#EnergyEfficient', '#LEDHome'],
                'smart': ['#SmartLighting', '#HomeAutomation', '#IoTHome'],
            };

            const additional = categoryHashtags[category.toLowerCase()];
            if (additional) {
                baseHashtags.push(...additional);
            }
        }

        // Limit to 10 hashtags (TikTok best practice)
        return baseHashtags.slice(0, 10);
    }

    /**
     * Get pending content to post.
     */
    async getPendingContent(): Promise<TikTokContentEntity[]> {
        const now = new Date();

        return this.contentRepo.find({
            where: {
                status: ContentStatus.SCHEDULED,
            },
            order: {
                scheduled_at: 'ASC',
            },
        });
    }

    /**
     * Mark content as posted.
     */
    async markAsPosted(contentId: string, tiktokPostId: string): Promise<void> {
        await this.contentRepo.update(contentId, {
            status: ContentStatus.POSTED,
            tiktok_post_id: tiktokPostId,
        });

        logger.info('Content marked as posted', { contentId, tiktokPostId });
    }

    /**
     * Mark content as failed.
     */
    async markAsFailed(contentId: string, errorMessage: string): Promise<void> {
        await this.contentRepo.update(contentId, {
            status: ContentStatus.FAILED,
            error_message: errorMessage,
        });

        logger.error('Content posting failed', { contentId, errorMessage });
    }

    /**
     * Update engagement metrics.
     */
    async updateMetrics(
        contentId: string,
        metrics: { views: number; likes: number; shares: number; comments: number }
    ): Promise<void> {
        await this.contentRepo.update(contentId, {
            views: metrics.views,
            likes: metrics.likes,
            shares: metrics.shares,
            comments: metrics.comments,
        });
    }

    /**
     * Get content performance report.
     */
    async getPerformanceReport(
        startDate: Date,
        endDate: Date
    ): Promise<{
        totalPosts: number;
        totalViews: number;
        totalLikes: number;
        avgEngagementRate: number;
        topPerformers: TikTokContentEntity[];
    }> {
        const content = await this.contentRepo
            .createQueryBuilder('c')
            .where('c.status = :status', { status: ContentStatus.POSTED })
            .andWhere('c.scheduled_at BETWEEN :startDate AND :endDate', { startDate, endDate })
            .getMany();

        const totalViews = content.reduce((sum, c) => sum + c.views, 0);
        const totalLikes = content.reduce((sum, c) => sum + c.likes, 0);
        const totalEngagement = content.reduce(
            (sum, c) => sum + c.likes + c.shares + c.comments,
            0
        );

        const avgEngagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

        // Top 5 performers by engagement
        const topPerformers = [...content]
            .sort((a, b) => b.likes + b.shares + b.comments - (a.likes + a.shares + a.comments))
            .slice(0, 5);

        return {
            totalPosts: content.length,
            totalViews,
            totalLikes,
            avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
            topPerformers,
        };
    }

    /**
     * Create viral script template for Cypher products.
     */
    createLightingScript(
        productName: string,
        keyBenefit: string,
        savingsPercentage: number
    ): string {
        return `🧲 Uită de fire. Viitorul este magnetic.

✨ ${productName}

🔧 Configurare instantanee - schimbă modulele în secunde
💡 Lumină premium cu tehnologie LED Clasa A++
💰 Reduce factura cu ${savingsPercentage}%, nu stilul

${keyBenefit}

🔗 Descoperă Cypher. Link în Bio.`;
    }
}
