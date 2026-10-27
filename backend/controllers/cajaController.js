'use strict';
const cajaService = require('../services/cajaService');

class CajaController {
  async getActiveTurno(req, res, next) {
    try {
      const negocioId = req.user.rol === 'superadmin' ? parseInt(req.query.negocio_id, 10) : req.user.negocio_id;
      const turno = await cajaService.getActiveTurno(negocioId, req.user.rol === 'recepcionista' ? req.user.id : null);
      res.json(turno || { estado: 'cerrada', mensaje: 'No hay turno activo para este usuario' });
    } catch (err) {
      next(err);
    }
  }

  async openTurno(req, res, next) {
    try {
      const negocioId = req.user.rol === 'superadmin' ? parseInt(req.body.negocio_id, 10) : req.user.negocio_id;
      const data = await cajaService.openTurno({
        negocioId,
        abiertaPorId: req.user.id,
        montoInicial: req.body.monto_inicial || 0,
        nombreRecepcionista: req.user.nombre
      });
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }

  async closeTurno(req, res, next) {
    try {
      const data = await cajaService.closeTurno(req.params.id, {
        cerradaPorId: req.user.id,
        efectivoContado: req.body.efectivo_contado,
        notasCierre: req.body.notas_cierre
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getHistorial(req, res, next) {
    try {
      const negocioId = req.user.rol === 'superadmin' ? (req.query.negocio_id ? parseInt(req.query.negocio_id, 10) : null) : req.user.negocio_id;
      const data = await cajaService.getHistorial({
        negocioId,
        limit: req.query.limit || 30
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CajaController();
