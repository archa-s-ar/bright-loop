const express = require('express');
const UsersController = require('./users.controller');
const validate = require('../../middleware/validate.middleware');
const { authenticateUser, authorizeRoles } = require('../../middleware/auth.middleware');
const {
  createStaffSchema,
  updateUserSchema,
  toggleStatusSchema,
  getUserByIdSchema,
  listUsersSchema,
} = require('./users.validation');

const router = express.Router();

// All user management routes require authentication
router.use(authenticateUser);

router.get('/', authorizeRoles('ADMIN', 'STAFF'), validate(listUsersSchema), UsersController.listUsers);
router.get('/:id', validate(getUserByIdSchema), UsersController.getUserById);
router.post('/staff', authorizeRoles('ADMIN'), validate(createStaffSchema), UsersController.createStaff);
router.patch('/:id', validate(updateUserSchema), UsersController.updateUser);
router.patch('/:id/status', authorizeRoles('ADMIN'), validate(toggleStatusSchema), UsersController.toggleStatus);

module.exports = router;
