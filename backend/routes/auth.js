'use strict';
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/registro', authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/logout', verifyToken, authController.logout);
router.get('/me', verifyToken, authController.me);

module.exports = router;
