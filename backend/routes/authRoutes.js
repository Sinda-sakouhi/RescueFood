const express = require('express');
const { rateLimit } = require('express-rate-limit');
const {
  register,
  login,
  me,
  updateProfile,
  logout
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message: 'Trop de tentatives. Réessayez dans 15 minutes.'
  }
});

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);
router.patch('/me', authenticate, updateProfile);
router.post('/logout', authenticate, logout);

module.exports = router;
