/**
 * IAudienceSegmentRepository
 * Port interface for audience segment persistence operations
 */
import { AudienceSegment } from '../entities/AudienceSegment';

export interface IAudienceSegmentRepository {
  save(segment: AudienceSegment): Promise<AudienceSegment>;
  findById(id: string): Promise<AudienceSegment | null>;
  findAll(
    filter: { search?: string; createdBy?: string },
    pagination: { page: number; limit: number },
  ): Promise<{ items: AudienceSegment[]; total: number; page: number; pages: number }>;
  findByName(name: string): Promise<AudienceSegment | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}
