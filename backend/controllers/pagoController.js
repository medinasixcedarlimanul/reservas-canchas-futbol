'use strict';
const pagoService = require('../services/pagoService');
const reservaService = require('../services/reservaService');

class PagoController {
  async getAll(req, res, next) {
    try {
      const negocioId = req.user.rol === 'admin' || req.user.rol === 'recepcionista'
        ? req.user.negocio_id
        : (req.query.negocio_id ? parseInt(req.query.negocio_id, 10) : null);

      const data = await pagoService.getAll({
        negocioId,
        estado: req.query.estado || null,
        metodo: req.query.metodo || null
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const data = await pagoService.getById(req.params.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const reserva = await reservaService.getById(req.body.reserva_id);

      const data = await pagoService.create({
        negocioId: reserva.negocio_id,
        reservaId: req.body.reserva_id,
        monto: req.body.monto,
        metodo: req.body.metodo,
        tipoPago: req.body.tipo_pago || 'completo',
        referencia: req.body.referencia || null,
        notas: req.body.notas || null,
        cajaTurnoId: req.body.caja_turno_id || null,
        registradoPor: req.user.id,
        emitirComprobante: req.body.emitir_comprobante === true,
        tipoComprobante: req.body.tipo_comprobante || 'boleta'
      });

      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }

  async refund(req, res, next) {
    try {
      const data = await pagoService.processRefund(req.params.id, {
        metodo: req.body.metodo || 'efectivo',
        canceladoPorId: req.user.id
      });
      res.json({ mensaje: 'Reembolso procesado exitosamente', pago: data });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PagoController();
