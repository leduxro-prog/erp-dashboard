import { PerformanceRepository } from '../../infrastructure/repositories/PerformanceRepository';
import { PerformanceReviewEntity } from '../../infrastructure/entities/PerformanceReview';
import { PerformanceKPIEntity } from '../../infrastructure/entities/PerformanceKPI';
import { PerformanceRatingEntity } from '../../infrastructure/entities/PerformanceRating';
import {
    CreatePerformanceReviewDTO,
    UpdatePerformanceReviewDTO,
    CreatePerformanceKPIDTO,
    UpdatePerformanceKPIDTO,
    PerformanceReviewListQueryDTO,
} from '../../application/dtos/PerformanceDTO';

export class PerformanceService {
    constructor(private performanceRepository: PerformanceRepository) {}

    async createPerformanceReview(dto: CreatePerformanceReviewDTO, createdBy: string): Promise<PerformanceReviewEntity> {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        if (startDate > endDate) {
            throw new Error('Start date must be before end date');
        }

        return await this.performanceRepository.createReview({
            ...dto,
            startDate,
            endDate,
            status: 'pending',
            createdBy,
        });
    }

    async getPerformanceReview(id: string): Promise<PerformanceReviewEntity> {
        const review = await this.performanceRepository.findReviewById(id);
        if (!review) {
            throw new Error(`Performance review ${id} not found`);
        }
        return review;
    }

    async updatePerformanceReview(
        id: string,
        dto: UpdatePerformanceReviewDTO,
        updatedBy: string
    ): Promise<PerformanceReviewEntity> {
        await this.getPerformanceReview(id);

        return (await this.performanceRepository.updateReview(id, {
            ...dto,
            updatedBy,
        }))!;
    }

    async submitPerformanceReview(id: string, updatedBy: string): Promise<PerformanceReviewEntity> {
        const review = await this.getPerformanceReview(id);

        if (review.status !== 'pending' && review.status !== 'in-progress') {
            throw new Error(`Cannot submit review in ${review.status} status`);
        }

        return (await this.performanceRepository.updateReview(id, {
            status: 'submitted',
            updatedBy,
        }))!;
    }

    async approvePerformanceReview(id: string, approvedBy: string): Promise<PerformanceReviewEntity> {
        const review = await this.getPerformanceReview(id);

        if (review.status !== 'submitted') {
            throw new Error('Can only approve submitted reviews');
        }

        return (await this.performanceRepository.updateReview(id, {
            status: 'approved',
            approvedBy,
            approvedAt: new Date(),
            updatedBy: approvedBy,
        }))!;
    }

    async acknowledgePerformanceReview(id: string, employeeId: string): Promise<PerformanceReviewEntity> {
        const review = await this.getPerformanceReview(id);

        if (review.employeeId !== employeeId) {
            throw new Error('Only the employee can acknowledge their review');
        }

        return (await this.performanceRepository.updateReview(id, {
            employeeAcknowledged: true,
            acknowledgedAt: new Date(),
            updatedBy: employeeId,
        }))!;
    }

    async listPerformanceReviews(query: PerformanceReviewListQueryDTO): Promise<{ data: PerformanceReviewEntity[]; total: number }> {
        const [reviews, total] = await this.performanceRepository.findReviews(query);
        return { data: reviews, total };
    }

    async createPerformanceKPI(dto: CreatePerformanceKPIDTO, createdBy: string): Promise<PerformanceKPIEntity> {
        return await this.performanceRepository.createKPI({
            ...dto,
            startDate: dto.startDate ? new Date(dto.startDate) : undefined,
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            status: 'not-started',
            createdBy,
        });
    }

    async getPerformanceKPI(id: string): Promise<PerformanceKPIEntity> {
        const kpi = await this.performanceRepository.findKPIById(id);
        if (!kpi) {
            throw new Error(`Performance KPI ${id} not found`);
        }
        return kpi;
    }

    async updatePerformanceKPI(id: string, dto: UpdatePerformanceKPIDTO, updatedBy: string): Promise<PerformanceKPIEntity> {
        await this.getPerformanceKPI(id);

        const updateData: any = { ...dto, updatedBy };

        if (dto.achievedValue && dto.targetValue) {
            updateData.achievementPercentage = (dto.achievedValue / dto.targetValue) * 100;
        }

        return (await this.performanceRepository.updateKPI(id, updateData))!;
    }

    async getEmployeeKPIs(employeeId: string, year: number): Promise<PerformanceKPIEntity[]> {
        return await this.performanceRepository.findKPIsByEmployee(employeeId, year);
    }

    async createPerformanceRatings(
        reviewId: string,
        ratings: Partial<PerformanceRatingEntity>[],
        createdBy: string
    ): Promise<PerformanceRatingEntity[]> {
        await this.getPerformanceReview(reviewId);

        const ratingsWithCreatedBy = ratings.map((r) => ({
            ...r,
            reviewId,
            createdBy,
        }));

        return await this.performanceRepository.bulkCreateRatings(ratingsWithCreatedBy);
    }

    async updatePerformanceRating(id: string, rating: number, feedback: string, updatedBy: string): Promise<PerformanceRatingEntity> {
        const perfRating = await this.performanceRepository.findRatingById(id);
        if (!perfRating) {
            throw new Error('Performance rating not found');
        }

        return (await this.performanceRepository.updateRating(id, {
            rating,
            feedback,
            status: 'rated',
            updatedBy,
        }))!;
    }

    async getReviewRatings(reviewId: string): Promise<PerformanceRatingEntity[]> {
        return await this.performanceRepository.findRatingsByReview(reviewId);
    }

    async calculateOverallRating(reviewId: string, updatedBy: string): Promise<PerformanceReviewEntity> {
        const review = await this.getPerformanceReview(reviewId);
        const ratings = await this.performanceRepository.findRatingsByReview(reviewId);

        if (ratings.length === 0 || ratings.some((r) => r.rating === null)) {
            throw new Error('Not all KPIs have been rated');
        }

        const weightedSum = ratings.reduce((sum, r) => sum + (r.rating! * r.weightage), 0);
        const totalWeightage = ratings.reduce((sum, r) => sum + r.weightage, 0);
        const overallRating = totalWeightage > 0 ? weightedSum / totalWeightage : 0;

        return (await this.performanceRepository.updateReview(reviewId, {
            overallRating: Math.round(overallRating * 10) / 10,
            status: 'completed',
            updatedBy,
        }))!;
    }
}
