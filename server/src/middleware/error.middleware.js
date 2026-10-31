const { ZodError } = require('zod');
const { Prisma } = require('@prisma/client');
const ApiError = require('../utils/apiError');
const env = require('../config/env');

function errorHandler(err, req, res, next) {
  let error = err;

  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError || err.name === 'ZodError') {
    const issues = err.issues || err.errors || [];
    const formattedErrors = issues.map((e) => ({
      field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
      message: e.message,
    }));
    error = ApiError.badRequest('Validation failed', formattedErrors);
  }

  // Handle Prisma Database Errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = err.meta?.target || 'field';
      error = ApiError.conflict(`A record with this ${target} already exists`);
    } else if (err.code === 'P2025') {
      error = ApiError.notFound('Requested record was not found');
    } else {
      error = ApiError.badRequest(`Database operation failed (${err.code})`);
    }
  }

  // Handle JWT Errors
  else if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid authentication token');
  } else if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Authentication token has expired. Please log in again.');
  }

  // Fallback for unhandled / non-ApiError exceptions
  else if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message);
  }

  const response = {
    success: false,
    message: error.message,
    ...(error.errors && { errors: error.errors }),
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  return res.status(error.statusCode || 500).json(response);
}

module.exports = errorHandler;
