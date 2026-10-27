'use strict';
const express = require('express');
const router = express.Router();
const deporteController = require('../controllers/deporteController');
const verifyToken = require('../middleware/verifyToken');
const checkRole = require('../middleware/checkRole');

router.get('/', deporteController.getAll);
router.get('/:id', deporteController.getById);
router.post('/', verifyToken, checkRole('superadmin', 'admin'), deporteController.create);

module.exports = router;
