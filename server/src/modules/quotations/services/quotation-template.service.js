// server/src/modules/quotations/services/quotation-template.service.js
const prisma = require('../../../config/prisma');
const ApiError = require('../../../utils/apiError');

async function listTemplates(query = {}) {
  const { isActive, search, page = 1, limit = 20 } = query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};
  if (isActive !== undefined && isActive !== '') {
    where.isActive = isActive === 'true' || isActive === true;
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.quotationTemplate.count({ where }),
    prisma.quotationTemplate.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          select: { id: true, name: true, billingCycle: true, planPrice: true, pricingMode: true },
        },
        lines: {
          include: {
            product: { select: { id: true, name: true, salesPrice: true } },
            variant: { select: { id: true, attributeName: true, attributeValue: true, priceDelta: true } },
          },
        },
      },
    }),
  ]);

  return {
    items,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / take) || 1,
    },
  };
}

async function getTemplateById(id) {
  const template = await prisma.quotationTemplate.findUnique({
    where: { id: Number(id) },
    include: {
      plan: {
        select: { id: true, name: true, billingCycle: true, planPrice: true, pricingMode: true },
      },
      lines: {
        include: {
          product: { select: { id: true, name: true, salesPrice: true } },
          variant: { select: { id: true, attributeName: true, attributeValue: true, priceDelta: true } },
        },
      },
    },
  });

  if (!template) {
    throw ApiError.notFound(`Quotation template with ID ${id} not found`);
  }
  return template;
}

async function createTemplate(data) {
  const { name, description, planId, validityDays, paymentTerms, lines = [] } = data;

  // Verify plan exists
  const plan = await prisma.plan.findUnique({ where: { id: Number(planId) } });
  if (!plan) {
    throw ApiError.notFound(`Plan with ID ${planId} not found`);
  }

  const template = await prisma.quotationTemplate.create({
    data: {
      name,
      description,
      planId: Number(planId),
      validityDays: Number(validityDays) || 30,
      paymentTerms,
      lines: {
        create: lines.map((l) => ({
          productId: Number(l.productId),
          variantId: l.variantId ? Number(l.variantId) : null,
          quantity: Number(l.quantity) || 1,
        })),
      },
    },
    include: {
      plan: true,
      lines: {
        include: { product: true, variant: true },
      },
    },
  });

  return template;
}

async function updateTemplate(id, data) {
  await getTemplateById(id);
  const { name, description, planId, validityDays, paymentTerms, isActive, lines } = data;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (planId !== undefined) updateData.planId = Number(planId);
  if (validityDays !== undefined) updateData.validityDays = Number(validityDays);
  if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;
  if (isActive !== undefined) updateData.isActive = isActive;

  if (Array.isArray(lines)) {
    updateData.lines = {
      deleteMany: {},
      create: lines.map((l) => ({
        productId: Number(l.productId),
        variantId: l.variantId ? Number(l.variantId) : null,
        quantity: Number(l.quantity) || 1,
      })),
    };
  }

  const updated = await prisma.quotationTemplate.update({
    where: { id: Number(id) },
    data: updateData,
    include: {
      plan: true,
      lines: {
        include: { product: true, variant: true },
      },
    },
  });

  return updated;
}

async function deactivateTemplate(id) {
  await getTemplateById(id);
  return prisma.quotationTemplate.update({
    where: { id: Number(id) },
    data: { isActive: false },
  });
}

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deactivateTemplate,
};

