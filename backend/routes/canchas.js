'use strict';
const express = require('express');
const router = express.Router();
const canchaController = require('../controllers/canchaController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');
const resolveTenant = require('../middleware/tenantContext');

router.get('/', resolveTenant, canchaController.getAll);
router.get('/:id', canchaController.getById);
router.get('/:id/disponibilidad', canchaController.getAvailability);

router.post('/', verifyToken, checkRole('superadmin', 'admin'), resolveTenant, canchaController.create);
router.put('/:id', verifyToken, checkRole('superadmin', 'admin'), resolveTenant, canchaController.update);

module.exports = router;
