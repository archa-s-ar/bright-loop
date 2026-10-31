// server/src/modules/subscriptions/services/subscription-history.service.js
const prisma = require('../../../config/prisma');

async function logHistory(subscriptionId, previousStatus, newStatus, changedById, reason) {
  return prisma.subscriptionHistory.create({
    data: {
      subscriptionId: Number(subscriptionId),
      previousStatus,
      newStatus,
      changedById: Number(changedById),
      reason,
    },
  });
}

async function getSubscriptionHistory(subscriptionId) {
  return prisma.subscriptionHistory.findMany({
    where: { subscriptionId: Number(subscriptionId) },
    orderBy: { changedAt: 'desc' },
    include: {
      changedBy: { select: { id: true, fullName: true, email: true, role: true } },
    },
  });
}

module.exports = {
  logHistory,
  getSubscriptionHistory,
};

