// src/modules/catalog/services/product.service.js
const prisma = require('../../../config/prisma');
const decimal = require('../../../utils/decimal');

/**
 * List products with filtering, search, and pagination.
 */
async function listProducts({ page = 1, limit = 10, search, status, productType, role }) {
  const take = Math.max(1, Number(limit) || 10);
  const skip = (Math.max(1, Number(page) || 1) - 1) * take;

  const where = {};

  // Role-based visibility: CUSTOMER or unauthenticated sees only ACTIVE products
  if (role === 'CUSTOMER' || !role) {
    where.status = 'ACTIVE';
  } else if (status) {
    where.status = status;
  }

  if (productType) {
    where.productType = productType;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } }
    ];
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take,
      include: {
        _count: {
          select: {
            variants: true,
            productTaxRules: true,
            planProducts: true
          }
        },
        productTaxRules: {
          include: {
            taxRule: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return {
    products,
    pagination: {
      total,
      page: Number(page),
      limit: take,
      totalPages: Math.ceil(total / take)
    }
  };
}

/**
 * Get product details by ID including variants and attached taxes.
 */
async function getProductById(id, { includeRelations = true } = {}) {
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    include: includeRelations ? {
      variants: {
        orderBy: { attributeName: 'asc' }
      },
      productTaxRules: {
        include: {
          taxRule: true
        }
      }
    } : undefined
  });

  return product;
}

/**
 * Create a new product.
 */
async function createProduct(data) {
  return prisma.product.create({
    data: {
      name: data.name,
      productType: data.productType,
      description: data.description ?? null,
      salesPrice: decimal.toDecimal(data.salesPrice),
      costPrice: decimal.toDecimal(data.costPrice),
      notes: data.notes ?? null,
      status: data.status ?? 'ACTIVE'
    }
  });
}

/**
 * Update an existing product.
 */
async function updateProduct(id, data) {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.productType !== undefined) updateData.productType = data.productType;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.salesPrice !== undefined) updateData.salesPrice = decimal.toDecimal(data.salesPrice);
  if (data.costPrice !== undefined) updateData.costPrice = decimal.toDecimal(data.costPrice);
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.status !== undefined) updateData.status = data.status;

  return prisma.product.update({
    where: { id: Number(id) },
    data: updateData
  });
}

/**
 * Set product status (ACTIVE, INACTIVE, ARCHIVED).
 */
async function setProductStatus(id, status) {
  return prisma.product.update({
    where: { id: Number(id) },
    data: { status }
  });
}

/**
 * List variants for a product.
 */
async function listVariants(productId) {
  return prisma.productVariant.findMany({
    where: { productId: Number(productId) },
    orderBy: [{ attributeName: 'asc' }, { attributeValue: 'asc' }]
  });
}

/**
 * Create a new variant for a product.
 */
async function createVariant(productId, data) {
  return prisma.productVariant.create({
    data: {
      productId: Number(productId),
      attributeName: data.attributeName,
      attributeValue: data.attributeValue,
      priceDelta: decimal.toDecimal(data.priceDelta ?? 0),
      isActive: data.isActive ?? true
    }
  });
}

/**
 * Update a variant.
 */
async function updateVariant(id, data) {
  const updateData = {};
  if (data.attributeName !== undefined) updateData.attributeName = data.attributeName;
  if (data.attributeValue !== undefined) updateData.attributeValue = data.attributeValue;
  if (data.priceDelta !== undefined) updateData.priceDelta = decimal.toDecimal(data.priceDelta);
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.productVariant.update({
    where: { id: Number(id) },
    data: updateData
  });
}

/**
 * Delete a variant.
 */
async function deleteVariant(id) {
  return prisma.productVariant.delete({
    where: { id: Number(id) }
  });
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  setProductStatus,
  listVariants,
  createVariant,
  updateVariant,
  deleteVariant
};

