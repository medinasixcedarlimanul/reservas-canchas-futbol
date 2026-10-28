'use strict';
const reporteService = require('../services/reporteService');

class ReporteController {
  async getDashboard(req, res, next) {
    try {
      const negocioId = req.user.rol === 'admin' || req.user.rol === 'recepcionista'
        ? req.user.negocio_id
        : (req.query.negocio_id ? parseInt(req.query.negocio_id, 10) : null);

      const data = await reporteService.getDashboard({
        negocioId,
        desde: req.query.desde,
        hasta: req.query.hasta
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReporteController();
