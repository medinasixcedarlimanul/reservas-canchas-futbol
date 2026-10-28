'use strict';
const authService = require('../services/authService');

class AuthController {
  async register(req, res, next) {
    try {
      const data = await authService.registerClient(req.body);
      res.status(201).json({
        mensaje: 'Registro exitoso',
        usuario: data
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.login({ email, password, ip, userAgent });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.logout({
        jti: req.user?.jti,
        usuarioId: req.user?.id,
        email: req.user?.email,
        negocioId: req.user?.negocio_id,
        ip,
        userAgent
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user.id);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
