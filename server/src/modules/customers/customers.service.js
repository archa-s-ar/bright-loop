const prisma = require('../../config/prisma');
const ApiError = require('../../utils/apiError');

class CustomersService {
  static async createCustomer(data) {
    const customer = await prisma.customer.create({
      data: {
        companyName: data.companyName,
        email: data.email,
        phone: data.phone || null,
        billingAddress: data.billingAddress || null,
        taxRegistrationNumber: data.taxRegistrationNumber || null,
        currency: data.currency || 'INR',
        isActive: true,
      },
    });

    return customer;
  }

  static async listCustomers({ search, isActive, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;
    const where = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { email: { contains: search } },
        { taxRegistrationNumber: { contains: search } },
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              subscriptions: true,
              invoices: true,
            },
          },
        },
      }),
    ]);

    return {
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  static async getCustomerById(id) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
            invoices: true,
            quotations: true,
          },
        },
      },
    });

    if (!customer) {
      throw ApiError.notFound('Customer organization not found');
    }

    return customer;
  }

  static async updateCustomer(id, data) {
    const existing = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existing) {
      throw ApiError.notFound('Customer organization not found');
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.companyName && { companyName: data.companyName }),
        ...(data.email && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.billingAddress !== undefined && { billingAddress: data.billingAddress }),
        ...(data.taxRegistrationNumber !== undefined && { taxRegistrationNumber: data.taxRegistrationNumber }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return updated;
  }
}

module.exports = CustomersService;
