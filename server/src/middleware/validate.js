// src/middleware/validate.js
// Zod validation middleware for request body, query, and params.

/**
 * Validates request data against a Zod schema.
 * @param {import('zod').ZodSchema} schema 
 * @param {'body' | 'query' | 'params'} source 
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const formattedErrors = result.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors: formattedErrors
      });
    }
    // Replace source with parsed & sanitized data
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };

