'use strict';
const jwt = require('jsonwebtoken');
const db = require('../db/connection');

async function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autorización requerido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_jwt_secret_reservas_multinegocio_2026_key');

    // Verificar si el token (jti) se encuentra en la lista de tokens revocados
    if (decoded.jti) {
      const [rows] = await db.query(
        'SELECT jti FROM tokens_revocados WHERE jti = ? AND expiry > NOW() LIMIT 1',
        [decoded.jti]
      );
      if (rows.length > 0) {
        return res.status(401).json({ error: 'La sesión ha expirado o el token ha sido revocado' });
      }
    }

    // Verificar que el usuario continúe activo en la base de datos
    const [userRows] = await db.query(
      'SELECT id, negocio_id, nombre, email, rol, activo, bloqueado_hasta FROM usuarios WHERE id = ? LIMIT 1',
      [decoded.userId || decoded.id]
    );

    if (userRows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const user = userRows[0];
    if (!user.activo) {
      return res.status(403).json({ error: 'Cuenta de usuario desactivada' });
    }

    if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
      return res.status(403).json({ error: 'Cuenta bloqueada temporalmente por seguridad' });
    }

    req.user = {
      id: user.id,
      negocio_id: user.negocio_id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      jti: decoded.jti
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = verifyToken;
