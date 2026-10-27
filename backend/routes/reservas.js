'use strict';
const express = require('express');
const router = express.Router();
const reservaController = require('../controllers/reservaController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');

router.use(verifyToken);

router.get('/', reservaController.getAll);
router.get('/codigo/:codigo', reservaController.getByCode);
router.get('/:id', reservaController.getById);
router.post('/', reservaController.create);
router.put('/:id/cancelar', reservaController.cancel);
router.put('/:id/checkin', checkRole('superadmin', 'admin', 'recepcionista'), reservaController.checkIn);

module.exports = router;
