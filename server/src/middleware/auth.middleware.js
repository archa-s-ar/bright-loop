const prisma = require('../config/prisma');
const ApiError = require('../utils/apiError');
const { verifyToken } = require('../utils/token');

async function authenticateUser(req, res, next) {
  try {
    let token = null;

    // 1. Prefer HTTP-Only Cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Fallback to Authorization Header (Bearer token)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(ApiError.unauthorized('Authentication required. Please log in.'));
    }

    const decoded = verifyToken(token);

    if (!decoded || !decoded.id) {
      return next(ApiError.unauthorized('Invalid authentication credentials'));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        customerId: true,
      },
    });

    if (!user) {
      return next(ApiError.unauthorized('User account no longer exists'));
    }

    if (!user.isActive) {
      return next(ApiError.forbidden('Your account has been deactivated. Please contact an administrator.'));
    }

    // Attach standardized identity contract to request
    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      customerId: user.customerId,
    };

    next();
  } catch (err) {
    next(err);
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(`Access forbidden: Requires one of [${allowedRoles.join(', ')}] role`)
      );
    }

    next();
  };
}

function requireCustomerOwnership(entityCustomerField = 'customerId') {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    // ADMIN and STAFF have cross-organization visibility
    if (req.user.role === 'ADMIN' || req.user.role === 'STAFF') {
      return next();
    }

    // CUSTOMER role is strictly restricted to their own organization
    if (req.user.role === 'CUSTOMER') {
      const targetCustomerId =
        req.params[entityCustomerField] ||
        req.body[entityCustomerField] ||
        req.query[entityCustomerField];

      if (!targetCustomerId || parseInt(targetCustomerId, 10) !== req.user.customerId) {
        return next(
          ApiError.forbidden('Access denied: You can only access records for your own organization')
        );
      }
    }

    next();
  };
}

module.exports = {
  authenticateUser,
  authorizeRoles,
  requireCustomerOwnership,
};
