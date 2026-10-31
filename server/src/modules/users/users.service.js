const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');
const { hashPassword } = require('../../utils/password');

class UsersService {
  static async createStaff({ fullName, email, password }) {
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw ApiError.conflict('A user with this email address already exists');
    }

    const passwordHash = await hashPassword(password);

    const staffUser = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: 'STAFF',
        customerId: null,
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return staffUser;
  }

  static async listUsers({ role, isActive, search, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const where = {};

    if (role) {
      where.role = role;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          customerId: true,
          customer: {
            select: {
              id: true,
              companyName: true,
            },
          },
        },
      }),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getUserById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        customerId: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            companyName: true,
            email: true,
            phone: true,
            billingAddress: true,
            taxRegistrationNumber: true,
            currency: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user;
  }

  static async updateUser(id, data, requestingUser) {
    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('User not found');
    }

    // Check unique email if updating email
    if (data.email && data.email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (emailTaken) {
        throw ApiError.conflict('An account with this email address already exists');
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(data.fullName && { fullName: data.fullName }),
        ...(data.email && { email: data.email }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        customerId: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  static async toggleUserStatus(id, isActive, requestingUser) {
    if (id === requestingUser.id && !isActive) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('User not found');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return updated;
  }
}

module.exports = UsersService;
