const express = require('express');
const {
  dashboard,
  listUsers,
  updateUserAccess
} = require('../controllers/adminController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, authorizeRoles('ADMIN'));
router.get('/dashboard', dashboard);
router.get('/users', listUsers);
router.patch('/users/:id/access', updateUserAccess);

module.exports = router;
