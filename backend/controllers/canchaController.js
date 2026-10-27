'use strict';
const canchaService = require('../services/canchaService');

class CanchaController {
  async getAll(req, res, next) {
    try {
      const negocioId = req.query.negocio_id ? parseInt(req.query.negocio_id, 10) : req.negocioId || null;
      const deporteId = req.query.deporte_id ? parseInt(req.query.deporte_id, 10) : null;
      const activo = req.query.activo !== undefined ? req.query.activo === 'true' : true;

      const data = await canchaService.getAll({ negocioId, deporteId, activo });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const data = await canchaService.getById(req.params.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const negocioId = req.user.rol === 'superadmin' ? req.body.negocio_id : req.user.negocio_id;
      const data = await canchaService.create({
        negocioId,
        deporteId: req.body.deporte_id,
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        capacidad: req.body.capacidad,
        precioHora: req.body.precio_hora,
        horaApertura: req.body.hora_apertura,
        horaCierre: req.body.hora_cierre
      });
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const data = await canchaService.update(req.params.id, req.body);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getAvailability(req, res, next) {
    try {
      const data = await canchaService.getAvailability(req.params.id, req.query.fecha);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CanchaController();
