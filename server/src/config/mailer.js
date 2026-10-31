const nodemailer = require('nodemailer');
const env = require('./env');

let transporter;
let verification;

function isSmtpConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM);
}

async function getTransporter() {
  if (transporter) return transporter;

  // Automated tests use a non-network transport. Every other environment must
  // have working SMTP configuration; it must never report mock delivery.
  if (env.NODE_ENV === 'test') {
    transporter = {
      sendMail: async () => ({ messageId: `test-${Date.now()}`, response: 'Test message accepted' }),
      verify: async () => true,
    };
    return transporter;
  }

  if (!isSmtpConfigured()) {
    const error = new Error('SMTP is not configured');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return transporter;
}

async function verifyEmailTransport() {
  const mailer = await getTransporter();
  if (!verification) {
    verification = mailer.verify().catch((error) => {
      verification = null;
      throw error;
    });
  }
  return verification;
}

async function sendEmail({ to, subject, text, html }) {
  const mailer = await getTransporter();
  await verifyEmailTransport();
  return mailer.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
}

module.exports = {
  getTransporter,
  isSmtpConfigured,
  verifyEmailTransport,
  sendEmail,
};
