// server/src/modules/billing/jobs/recurring-billing.job.js
const cron = require('node-cron');
const env = require('../../../config/env');
const { runRecurringBilling } = require('../services/recurring-billing.service');

let cronTask = null;

function initBillingCron() {
  const schedule = env.BILLING_CRON_SCHEDULE || '0 0 * * *';

  if (!cron.validate(schedule)) {
    console.error(`❌ [BILLING CRON] Invalid cron schedule: "${schedule}". Scheduler disabled.`);
    return null;
  }

  cronTask = cron.schedule(schedule, async () => {
    console.log(`⏰ [BILLING CRON] Scheduled billing trigger fired at ${new Date().toISOString()}`);
    try {
      await runRecurringBilling();
    } catch (err) {
      console.error('❌ [BILLING CRON] Scheduled billing execution failed:', err);
    }
  });

  console.log(`🕒 [BILLING CRON] Recurring billing scheduler active with pattern: "${schedule}"`);
  return cronTask;
}

module.exports = {
  initBillingCron,
};

