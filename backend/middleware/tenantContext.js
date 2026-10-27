'use strict';

/**
 * Middleware para resolver y validar el contexto de negocio (Multi-Tenant).
 */
function resolveTenant(req, res, next) {
  const paramNegocio = req.params.negocioId || req.query.negocio_id || req.body.negocio_id || req.headers['x-negocio-id'];
  const targetNegocioId = paramNegocio ? parseInt(paramNegocio, 10) : null;

  // Si el usuario pertenece a un negocio específico (admin o recepcionista)
  if (req.user && req.user.negocio_id) {
    if (targetNegocioId && targetNegocioId !== req.user.negocio_id) {
      return res.status(403).json({ error: 'Acceso denegado: no puedes operar en un negocio diferente al asignado' });
    }
    req.negocioId = req.user.negocio_id;
    return next();
  }

  // Clientes y superadministradores pueden consultar o actuar sobre el negocio indicado
  if (targetNegocioId) {
    req.negocioId = targetNegocioId;
  }

  next();
}

module.exports = resolveTenant;
