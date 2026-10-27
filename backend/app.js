'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const negocioRoutes = require('./routes/negocios');
const deporteRoutes = require('./routes/deportes');
const canchaRoutes = require('./routes/canchas');
const reservaRoutes = require('./routes/reservas');
const pagoRoutes = require('./routes/pagos');
const cajaRoutes = require('./routes/caja');
const cuponRoutes = require('./routes/cupones');
const reporteRoutes = require('./routes/reportes');

const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

// Configuración de cabeceras de seguridad HTTP
app.use(helmet());

// CORS habilitado para entornos locales y configurables
app.use(cors({
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-negocio-id'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'reservas-canchas-backend',
    timestamp: new Date().toISOString()
  });
});

// Enrutamiento de la API
app.use('/api/auth', authRoutes);
app.use('/api/negocios', negocioRoutes);
app.use('/api/deportes', deporteRoutes);
app.use('/api/canchas', canchaRoutes);
app.use('/api/reservas', reservaRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/cupones', cuponRoutes);
app.use('/api/reportes', reporteRoutes);

// Manejo de rutas inexistentes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Manejador global de errores
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor backend escuchando en el puerto ${PORT}`);
    console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
