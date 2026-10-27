'use strict';

/**
 * Middleware para validar roles de usuario.
 * @param  {...string} rolesPermitidos - Lista de roles permitidos ('superadmin', 'admin', 'recepcionista', 'cliente')
 */
function checkRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user || !req.user.rol) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // El superadmin tiene privilegios globales
    if (req.user.rol === 'superadmin') {
      return next();
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos suficientes para realizar esta acción' });
    }

    next();
  };
}

module.exports = checkRole;
