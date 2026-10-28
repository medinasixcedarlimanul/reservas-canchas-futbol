'use strict';
const express = require('express');
const router = express.Router();
const pagoController = require('../controllers/pagoController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');

router.use(verifyToken);

router.get('/', checkRole('superadmin', 'admin', 'recepcionista'), pagoController.getAll);
router.get('/:id', pagoController.getById);
router.post('/', checkRole('superadmin', 'admin', 'recepcionista'), pagoController.create);
router.post('/:id/reembolso', checkRole('superadmin', 'admin', 'recepcionista'), pagoController.refund);

module.exports = router;
