'use strict';
const reservaService = require('../services/reservaService');
const canchaService = require('../services/canchaService');

class ReservaController {
  async getAll(req, res, next) {
    try {
      const isClient = req.user.rol === 'cliente';
      const usuarioId = isClient ? req.user.id : (req.query.usuario_id ? parseInt(req.query.usuario_id, 10) : null);
      const negocioId = req.user.rol === 'admin' || req.user.rol === 'recepcionista'
        ? req.user.negocio_id
        : (req.query.negocio_id ? parseInt(req.query.negocio_id, 10) : null);

      const fecha = req.query.fecha || null;
      const estado = req.query.estado || null;

      const data = await reservaService.getAll({ negocioId, usuarioId, fecha, estado });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const data = await reservaService.getById(req.params.id);

      // Si es cliente, verificar que le pertenezca
      if (req.user.rol === 'cliente' && data.usuario_id !== req.user.id) {
        return res.status(403).json({ error: 'Acceso denegado a esta reserva' });
      }

      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getByCode(req, res, next) {
    try {
      const data = await reservaService.getByCode(req.params.codigo);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const cancha = await canchaService.getById(req.body.cancha_id);
      const isClient = req.user.rol === 'cliente';

      const usuarioId = isClient ? req.user.id : (req.body.usuario_id || req.user.id);
      const origen = isClient ? 'linea' : (req.body.origen || 'recepcion');

      const data = await reservaService.create({
        negocioId: cancha.negocio_id,
        canchaId: req.body.cancha_id,
        usuarioId,
        fecha: req.body.fecha,
        horaInicio: req.body.hora_inicio,
        horaFin: req.body.hora_fin,
        origen,
        notas: req.body.notas,
        clienteNombre: req.body.cliente_nombre,
        clienteDni: req.body.cliente_dni
      });

      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }

  async cancel(req, res, next) {
    try {
      const data = await reservaService.cancel(req.params.id, {
        canceladoPorId: req.user.id,
        rol: req.user.rol
      });
      res.json({ mensaje: 'Reserva cancelada correctamente', reserva: data });
    } catch (err) {
      next(err);
    }
  }

  async checkIn(req, res, next) {
    try {
      const data = await reservaService.checkIn(req.params.id, req.user.id);
      res.json({ mensaje: 'Check-in registrado exitosamente', reserva: data });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReservaController();
