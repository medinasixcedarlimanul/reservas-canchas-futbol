'use strict';
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máximo 20 intentos de login
  message: { error: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Límite de solicitudes alcanzado. Por favor espera unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  authLimiter,
  generalLimiter
};
