export const successResponse = (data: any, message = 'Success', statusCode = 200) => {
    return {
        success: true,
        message,
        data,
        statusCode,
    };
};

export const errorResponse = (errorCode: string, message: string, statusCode = 500) => {
    return {
        success: false,
        errorCode,
        message,
        statusCode,
    };
};

export const paginatedResponse = (data: any[], total: number, page: number, limit: number) => {
    const totalPages = Math.ceil(total / limit);
    return {
        success: true,
        data,
        meta: {
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
        statusCode: 200,
    };
};
