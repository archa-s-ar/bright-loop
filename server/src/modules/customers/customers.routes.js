const express = require('express');
const CustomersController = require('./customers.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticateUser, authorizeRoles } = require('../../middleware/auth.middleware');
const {
  createCustomerSchema,
  updateCustomerSchema,
  getCustomerByIdSchema,
  listCustomersSchema,
} = require('./customers.validation');

const router = express.Router();

router.use(authenticateUser);

router.get('/', authorizeRoles('ADMIN', 'STAFF'), validate(listCustomersSchema), CustomersController.listCustomers);
router.get('/:id', validate(getCustomerByIdSchema), CustomersController.getCustomerById);
router.post('/', authorizeRoles('ADMIN', 'STAFF'), validate(createCustomerSchema), CustomersController.createCustomer);
router.patch('/:id', validate(updateCustomerSchema), CustomersController.updateCustomer);

module.exports = router;
