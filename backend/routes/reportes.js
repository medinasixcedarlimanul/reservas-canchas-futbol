'use strict';
const express = require('express');
const router = express.Router();
const reporteController = require('../controllers/reporteController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');

router.use(verifyToken);
router.use(checkRole('superadmin', 'admin'));

router.get('/dashboard', reporteController.getDashboard);

module.exports = router;
