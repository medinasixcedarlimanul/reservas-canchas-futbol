'use strict';
const express = require('express');
const router = express.Router();
const pasarelaController = require('../controllers/pasarelaController');
const verifyToken = require('../middleware/verifyToken');

// Rutas de inicio de pago (requiere sesión del cliente)
router.post('/iniciar', verifyToken, pasarelaController.iniciar.bind(pasarelaController));

// Webhooks de pasarelas (públicos para recibir notificaciones HTTP externas)
router.post('/webhook/flow', pasarelaController.webhookFlow.bind(pasarelaController));
router.post('/webhook/stripe', pasarelaController.webhookStripe.bind(pasarelaController));

// Retorno de navegación web tras pagar
router.get('/retorno', pasarelaController.retornoWeb.bind(pasarelaController));

// Consulta de estado de orden
router.get('/estado/:token', verifyToken, pasarelaController.consultarEstado.bind(pasarelaController));

// Sandbox Checkout para pruebas locales sin credenciales
router.get('/sandbox-checkout', pasarelaController.renderSandboxCheckout.bind(pasarelaController));
router.post('/sandbox-confirmar', pasarelaController.confirmarSandbox.bind(pasarelaController));

module.exports = router;

