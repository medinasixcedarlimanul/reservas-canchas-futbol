'use strict';
const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');

router.use(verifyToken);
router.use(checkRole('superadmin', 'admin', 'recepcionista'));

router.get('/turno-activo', cajaController.getActiveTurno);
router.post('/abrir', cajaController.openTurno);
router.post('/cerrar/:id', cajaController.closeTurno);
router.get('/historial', cajaController.getHistorial);

module.exports = router;
