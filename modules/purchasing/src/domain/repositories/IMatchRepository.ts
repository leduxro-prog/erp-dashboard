import {
  ThreeWayMatch,
  MatchException,
  MatchExceptionResolution,
  MatchStatus,
  ExceptionType,
} from '../entities/ThreeWayMatch';
import { IPaginationOptions, IPaginatedResult } from './IRequisitionRepository';

export interface IMatchRepository {
  create(match: ThreeWayMatch): Promise<ThreeWayMatch>;
  findById(id: string): Promise<ThreeWayMatch | null>;
  findByPO(poId: string): Promise<ThreeWayMatch[]>;
  findByGRN(grnId: string): Promise<ThreeWayMatch | null>;
  findByInvoice(invoiceId: string): Promise<ThreeWayMatch | null>;
  findByStatus(
    status: MatchStatus,
    options: IPaginationOptions
  ): Promise<IPaginatedResult<ThreeWayMatch>>;
  findWithExceptions(
    options: IPaginationOptions
  ): Promise<IPaginatedResult<ThreeWayMatch>>;
  findAll(
    options: IPaginationOptions
  ): Promise<IPaginatedResult<ThreeWayMatch>>;
  update(id: string, updates: Partial<ThreeWayMatch>): Promise<void>;
  delete(id: string): Promise<void>;

  // Exception operations
  addException(matchId: string, exception: MatchException): Promise<void>;
  updateException(
    exceptionId: string,
    updates: Partial<MatchException>
  ): Promise<void>;
  removeException(matchId: string, exceptionId: string): Promise<void>;
  getExceptions(matchId: string): Promise<MatchException[]>;
  getExceptionsByType(type: ExceptionType): Promise<MatchException[]>;
  getPendingExceptions(): Promise<MatchException[]>;

  // Resolution operations
  createResolution(
    resolution: MatchExceptionResolution
  ): Promise<MatchExceptionResolution>;
  getResolutions(exceptionId: string): Promise<MatchExceptionResolution[]>;

  // Utility
  countByStatus(status: MatchStatus): Promise<number>;
  countWithExceptions(): Promise<number>;
}
