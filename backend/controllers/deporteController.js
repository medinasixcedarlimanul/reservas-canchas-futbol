'use strict';
const deporteService = require('../services/deporteService');

class DeporteController {
  async getAll(req, res, next) {
    try {
      const activo = req.query.activo !== undefined ? req.query.activo === 'true' : true;
      const data = await deporteService.getAll({ activo });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const data = await deporteService.getById(req.params.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const data = await deporteService.create(req.body);
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DeporteController();
