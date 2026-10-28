'use strict';
const cuponService = require('../services/cuponService');

class CuponController {
  async getAll(req, res, next) {
    try {
      const negocioId = req.user.rol === 'admin' || req.user.rol === 'recepcionista'
        ? req.user.negocio_id
        : (req.query.negocio_id ? parseInt(req.query.negocio_id, 10) : null);

      const data = await cuponService.getAll({
        negocioId,
        estado: req.query.estado || null
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const data = await cuponService.getById(req.params.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async validate(req, res, next) {
    try {
      const { codigo, negocio_id } = req.query;
      const data = await cuponService.validateCoupon(codigo, negocio_id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const negocioId = req.user.rol === 'superadmin' ? req.body.negocio_id : req.user.negocio_id;
      const data = await cuponService.create({
        negocioId,
        valorInicial: req.body.valor_inicial,
        motivo: req.body.motivo,
        reservaOrigenId: req.body.reserva_origen_id,
        generadoPor: req.user.id
      });
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }

  async redeem(req, res, next) {
    try {
      const data = await cuponService.redeem(req.params.id, {
        reservaId: req.body.reserva_id,
        monto: req.body.monto,
        registradoPor: req.user.id
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CuponController();
