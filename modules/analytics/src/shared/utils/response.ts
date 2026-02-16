/**
 * API Response Helpers
 * Standardized response format for API endpoints
 */

export function successResponse<T>(data: T, meta?: Record<string, any>) {
    return { success: true, data, ...(meta && { meta }) };
}

export function errorResponse(code: string, message: string, statusCode: number = 400) {
    return { success: false, error: { code, message, statusCode } };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
    return {
        success: true,
        data,
        meta: {
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        }
    };
}
