import { Repository, DataSource } from 'typeorm';
import { PerformanceReviewEntity } from '../entities/PerformanceReview';
import { PerformanceKPIEntity } from '../entities/PerformanceKPI';
import { PerformanceRatingEntity } from '../entities/PerformanceRating';
import { PerformanceReviewListQueryDTO } from '../../application/dtos/PerformanceDTO';

export class PerformanceRepository {
    private reviewRepository: Repository<PerformanceReviewEntity>;
    private kpiRepository: Repository<PerformanceKPIEntity>;
    private ratingRepository: Repository<PerformanceRatingEntity>;

    constructor(dataSource: DataSource) {
        this.reviewRepository = dataSource.getRepository(PerformanceReviewEntity);
        this.kpiRepository = dataSource.getRepository(PerformanceKPIEntity);
        this.ratingRepository = dataSource.getRepository(PerformanceRatingEntity);
    }

    async createReview(review: Partial<PerformanceReviewEntity>): Promise<PerformanceReviewEntity> {
        const newReview = this.reviewRepository.create(review);
        return await this.reviewRepository.save(newReview);
    }

    async findReviewById(id: string): Promise<PerformanceReviewEntity | null> {
        return await this.reviewRepository.findOne({
            where: { id },
        });
    }

    async findReviews(query: PerformanceReviewListQueryDTO): Promise<[PerformanceReviewEntity[], number]> {
        const qb = this.reviewRepository.createQueryBuilder('pr');

        if (query.employeeId) {
            qb.andWhere('pr.employeeId = :employeeId', { employeeId: query.employeeId });
        }

        if (query.reviewerId) {
            qb.andWhere('pr.reviewerId = :reviewerId', { reviewerId: query.reviewerId });
        }

        if (query.reviewType) {
            qb.andWhere('pr.reviewType = :reviewType', { reviewType: query.reviewType });
        }

        if (query.status) {
            qb.andWhere('pr.status = :status', { status: query.status });
        }

        const sortBy = query.sortBy || 'startDate';
        const sortOrder = query.sortOrder || 'DESC';
        qb.orderBy(`pr.${sortBy}`, sortOrder);

        const page = query.page || 1;
        const limit = query.limit || 10;
        const skip = (page - 1) * limit;

        qb.skip(skip).take(limit);

        return await qb.getManyAndCount();
    }

    async updateReview(id: string, review: Partial<PerformanceReviewEntity>): Promise<PerformanceReviewEntity | null> {
        await this.reviewRepository.update(id, review);
        return await this.findReviewById(id);
    }

    async createKPI(kpi: Partial<PerformanceKPIEntity>): Promise<PerformanceKPIEntity> {
        const newKPI = this.kpiRepository.create(kpi);
        return await this.kpiRepository.save(newKPI);
    }

    async findKPIById(id: string): Promise<PerformanceKPIEntity | null> {
        return await this.kpiRepository.findOne({
            where: { id },
        });
    }

    async findKPIsByEmployee(employeeId: string, year: number): Promise<PerformanceKPIEntity[]> {
        return await this.kpiRepository.find({
            where: { employeeId, year },
        });
    }

    async updateKPI(id: string, kpi: Partial<PerformanceKPIEntity>): Promise<PerformanceKPIEntity | null> {
        await this.kpiRepository.update(id, kpi);
        return await this.findKPIById(id);
    }

    async createRating(rating: Partial<PerformanceRatingEntity>): Promise<PerformanceRatingEntity> {
        const newRating = this.ratingRepository.create(rating);
        return await this.ratingRepository.save(newRating);
    }

    async findRatingsByReview(reviewId: string): Promise<PerformanceRatingEntity[]> {
        return await this.ratingRepository.find({
            where: { reviewId },
        });
    }

    async findRatingById(id: string): Promise<PerformanceRatingEntity | null> {
        return await this.ratingRepository.findOne({
            where: { id },
        });
    }

    async updateRating(id: string, rating: Partial<PerformanceRatingEntity>): Promise<PerformanceRatingEntity | null> {
        await this.ratingRepository.update(id, rating);
        return await this.findRatingById(id);
    }

    async bulkCreateRatings(ratings: Partial<PerformanceRatingEntity>[]): Promise<PerformanceRatingEntity[]> {
        const newRatings = this.ratingRepository.create(ratings);
        return await this.ratingRepository.save(newRatings);
    }
}
