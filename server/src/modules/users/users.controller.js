const UsersService = require('./users.service');
const ApiResponse = require('../../utils/apiResponse');
const ApiError = require('../../utils/apiError');

class UsersController {
  static async createStaff(req, res, next) {
    try {
      const staffUser = await UsersService.createStaff(req.body);
      return ApiResponse.created(res, staffUser, 'Staff user created successfully');
    } catch (err) {
      next(err);
    }
  }

  static async listUsers(req, res, next) {
    try {
      const data = await UsersService.listUsers(req.query);
      return ApiResponse.success(res, data, 'User list retrieved');
    } catch (err) {
      next(err);
    }
  }

  static async getUserById(req, res, next) {
    try {
      const targetId = req.params.id;

      // Access rule: CUSTOMER can only view their own user profile
      if (req.user.role === 'CUSTOMER' && req.user.id !== targetId) {
        throw ApiError.forbidden('Access denied: You may only view your own user profile');
      }

      const user = await UsersService.getUserById(targetId);
      return ApiResponse.success(res, user, 'User details');
    } catch (err) {
      next(err);
    }
  }

  static async updateUser(req, res, next) {
    try {
      const targetId = req.params.id;

      // Access rule: Only ADMIN can update any user; users can update their own name
      if (req.user.role !== 'ADMIN' && req.user.id !== targetId) {
        throw ApiError.forbidden('Access denied: You can only update your own profile');
      }

      const updated = await UsersService.updateUser(targetId, req.body, req.user);
      return ApiResponse.success(res, updated, 'User updated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async toggleStatus(req, res, next) {
    try {
      const updated = await UsersService.toggleUserStatus(req.params.id, req.body.isActive, req.user);
      return ApiResponse.success(res, updated, `User account ${updated.isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UsersController;
