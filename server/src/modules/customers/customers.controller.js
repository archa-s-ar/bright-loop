const CustomersService = require('./customers.service');
const ApiResponse = require('../../utils/apiResponse');
const ApiError = require('../../utils/apiError');

class CustomersController {
  static async createCustomer(req, res, next) {
    try {
      const customer = await CustomersService.createCustomer(req.body);
      return ApiResponse.created(res, customer, 'Customer organization created successfully');
    } catch (err) {
      next(err);
    }
  }

  static async listCustomers(req, res, next) {
    try {
      const data = await CustomersService.listCustomers(req.query);
      return ApiResponse.success(res, data, 'Customers list retrieved');
    } catch (err) {
      next(err);
    }
  }

  static async getCustomerById(req, res, next) {
    try {
      const targetId = req.params.id;

      // Ownership enforcement: CUSTOMER role cannot inspect other organizations
      if (req.user.role === 'CUSTOMER' && req.user.customerId !== targetId) {
        throw ApiError.forbidden('Access denied: You may only view your own organization');
      }

      const customer = await CustomersService.getCustomerById(targetId);
      return ApiResponse.success(res, customer, 'Customer details');
    } catch (err) {
      next(err);
    }
  }

  static async updateCustomer(req, res, next) {
    try {
      const targetId = req.params.id;

      // Ownership enforcement
      if (req.user.role === 'CUSTOMER') {
        if (req.user.customerId !== targetId) {
          throw ApiError.forbidden('Access denied: You can only update your own organization profile');
        }
        // Customers cannot toggle their own active status
        delete req.body.isActive;
      }

      const updated = await CustomersService.updateCustomer(targetId, req.body);
      return ApiResponse.success(res, updated, 'Customer profile updated successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CustomersController;
