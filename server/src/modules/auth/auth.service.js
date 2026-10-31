const prisma = require('../../config/prisma');
const env = require('../../config/env');
const ApiError = require('../../utils/apiError');
const { hashPassword, comparePassword } = require('../../utils/password');
const { generateToken, generateRandomToken, hashToken } = require('../../utils/token');
const { sendEmail } = require('../../config/mailer');

class AuthService {
  static async registerCustomer(data) {
    const { companyName, fullName, email, password, phone, billingAddress, taxRegistrationNumber } = data;

    // 1. Verify unique email address
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw ApiError.conflict('An account with this email address already exists');
    }

    // 2. Hash password
    const passwordHash = await hashPassword(password);

    // 3. Atomically create Customer organization and initial CUSTOMER user
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          companyName,
          email,
          phone: phone || null,
          billingAddress: billingAddress || null,
          taxRegistrationNumber: taxRegistrationNumber || null,
          currency: 'INR',
          isActive: true,
        },
      });

      const user = await tx.user.create({
        data: {
          customerId: customer.id,
          fullName,
          email,
          passwordHash,
          role: 'CUSTOMER', // Strict: Public registration can NEVER create ADMIN or STAFF
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          customerId: true,
          createdAt: true,
        },
      });

      return { customer, user };
    });

    // 4. Generate JWT
    const token = generateToken({
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
      customerId: result.user.customerId,
    });

    return {
      user: result.user,
      customer: result.customer,
      token,
    };
  }

  static async loginUser(email, password) {
    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        customer: {
          select: {
            id: true,
            companyName: true,
            currency: true,
            isActive: true,
          },
        },
      },
    });

    // 2. Generic error message to prevent account enumeration
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // 3. Check account activation
    if (!user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated. Please contact an administrator.');
    }

    // 4. Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // 5. Update last login timestamp asynchronously
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 6. Generate signed JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      customerId: user.customerId,
    });

    const userProfile = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      customerId: user.customerId,
      customer: user.customer,
    };

    return { user: userProfile, token };
  }

  static async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

  static async requestPasswordReset(email) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Timing-safe response: avoid leaking whether the email exists
    if (!user || !user.isActive) {
      return { message: 'If an account exists with this email, a password reset link has been sent.' };
    }

    // Generate cryptographic reset token
    const rawToken = generateRandomToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

    // Invalidate any existing unused reset tokens for this user
    await prisma.passwordReset.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Save token hash to database
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Send email with reset URL
    const resetUrl = `${env.APP_URL}/reset-password.html?token=${rawToken}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>Hello ${user.fullName},</p>
        <p>You requested a password reset for your Brightloop account. Click the button below to set a new password:</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            Reset My Password
          </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #64748b;">${resetUrl}</p>
        <p>This link is valid for 1 hour. If you did not request this reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">Brightloop Subscription Management System</p>
      </div>
    `;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your Brightloop password',
        text: `You requested a password reset for Brightloop. Please visit: ${resetUrl} (Valid for 1 hour).`,
        html: emailHtml,
      });
    } catch (mailError) {
      const code = typeof mailError.code === 'string' && /^[A-Z0-9_]+$/.test(mailError.code)
        ? mailError.code
        : 'DELIVERY_FAILED';
      console.error(`Password reset email delivery failed (${code}).`);
      // Keep the generic response to prevent account enumeration. The safe log
      // entry makes SMTP configuration and delivery failures observable.
    }

    return { message: 'If an account exists with this email, a password reset link has been sent.' };
  }

  static async resetPassword(token, newPassword) {
    const tokenHash = hashToken(token);

    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!resetRecord || !resetRecord.user) {
      throw ApiError.badRequest('Invalid or expired password reset link. Please request a new one.');
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Password has been successfully reset. You may now log in with your new password.' };
  }

  static async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password has been changed successfully' };
  }
}

module.exports = AuthService;
