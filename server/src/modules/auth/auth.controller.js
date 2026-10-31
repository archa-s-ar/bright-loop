const AuthService = require('./auth.service');
const ApiResponse = require('../../utils/apiResponse');
const env = require('../../config/env');

const COOKIE_NAME = 'token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
  path: '/',
};

class AuthController {
  static async register(req, res, next) {
    try {
      const result = await AuthService.registerCustomer(req.body);
      res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
      return ApiResponse.created(
        res,
        {
          user: result.user,
          customer: result.customer,
          token: result.token,
        },
        'Registration successful'
      );
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.loginUser(email, password);
      res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
      return ApiResponse.success(
        res,
        {
          user: result.user,
          token: result.token,
        },
        'Login successful'
      );
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      return ApiResponse.success(res, null, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req, res, next) {
    try {
      const user = await AuthService.getCurrentUser(req.user.id);
      return ApiResponse.success(res, user, 'Current user profile');
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await AuthService.requestPasswordReset(email);
      return ApiResponse.success(res, null, result.message);
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      const result = await AuthService.resetPassword(token, newPassword);
      return ApiResponse.success(res, null, result.message);
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await AuthService.changePassword(req.user.id, currentPassword, newPassword);
      return ApiResponse.success(res, null, result.message);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
