'use strict';
const express = require('express');
const router = express.Router();
const negocioController = require('../controllers/negocioController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');
const resolveTenant = require('../middleware/tenantContext');

router.get('/', negocioController.getAll);
router.get('/:id', negocioController.getById);

// Creación de negocio reservada para superadmin
router.post('/', verifyToken, checkRole('superadmin'), negocioController.create);

// Edición de negocio por superadmin o admin asignado a ese negocio
router.put('/:id', verifyToken, checkRole('superadmin', 'admin'), resolveTenant, negocioController.update);

module.exports = router;
