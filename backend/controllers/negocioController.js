'use strict';
const negocioService = require('../services/negocioService');

class NegocioController {
  async getAll(req, res, next) {
    try {
      const activo = req.query.activo !== undefined ? req.query.activo === 'true' : true;
      const data = await negocioService.getAll({ activo });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const data = await negocioService.getById(req.params.id);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const data = await negocioService.create(req.body);
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const data = await negocioService.update(req.params.id, req.body);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NegocioController();
