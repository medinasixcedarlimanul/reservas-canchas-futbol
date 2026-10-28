'use strict';
const express = require('express');
const router = express.Router();
const cuponController = require('../controllers/cuponController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');

router.use(verifyToken);

router.get('/validar', cuponController.validate);
router.get('/', checkRole('superadmin', 'admin', 'recepcionista'), cuponController.getAll);
router.get('/:id', checkRole('superadmin', 'admin', 'recepcionista'), cuponController.getById);
router.post('/', checkRole('superadmin', 'admin', 'recepcionista'), cuponController.create);
router.post('/:id/canjear', checkRole('superadmin', 'admin', 'recepcionista'), cuponController.redeem);

module.exports = router;
