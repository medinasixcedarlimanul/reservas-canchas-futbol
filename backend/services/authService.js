'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/connection');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

class AuthService {
  async registerClient({ nombre, email, password, telefono, dni }) {
    if (!nombre || !email || !password) {
      const error = new Error('Nombre, email y contraseña son obligatorios');
      error.statusCode = 400;
      throw error;
    }

    const emailNorm = email.trim().toLowerCase();

    // Validar existencia previa
    const [existing] = await db.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [emailNorm]);
    if (existing.length > 0) {
      const error = new Error('El correo electrónico ya se encuentra registrado');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, dni, negocio_id)
       VALUES (?, ?, ?, 'cliente', ?, ?, NULL)`,
      [nombre.trim(), emailNorm, passwordHash, telefono || null, dni || null]
    );

    return {
      id: result.insertId,
      nombre: nombre.trim(),
      email: emailNorm,
      rol: 'cliente'
    };
  }

  async login({ email, password, ip, userAgent }) {
    if (!email || !password) {
      const error = new Error('Email y contraseña requeridos');
      error.statusCode = 400;
      throw error;
    }

    const emailNorm = email.trim().toLowerCase();

    const [rows] = await db.query(
      `SELECT id, negocio_id, nombre, email, password_hash, rol, activo, login_intentos, bloqueado_hasta
       FROM usuarios WHERE email = ? LIMIT 1`,
      [emailNorm]
    );

    if (rows.length === 0) {
      await this.recordAudit({ email: emailNorm, accion: 'LOGIN', resultado: 'fallido', detalle: 'Usuario no existe', ip, userAgent });
      const error = new Error('Credenciales inválidas');
      error.statusCode = 401;
      throw error;
    }

    const user = rows[0];

    if (!user.activo) {
      await this.recordAudit({ usuarioId: user.id, email: emailNorm, accion: 'LOGIN', resultado: 'fallido', detalle: 'Cuenta inactiva', ip, userAgent });
      const error = new Error('Esta cuenta ha sido desactivada');
      error.statusCode = 403;
      throw error;
    }

    // Comprobar bloqueo temporal
    if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
      const minutosRestantes = Math.ceil((new Date(user.bloqueado_hasta) - new Date()) / 60000);
      const error = new Error(`Cuenta bloqueada temporalmente por intentos fallidos. Intenta nuevamente en ${minutosRestantes} minuto(s)`);
      error.statusCode = 403;
      throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const intentos = (user.login_intentos || 0) + 1;
      let bloqueadoHasta = null;

      if (intentos >= MAX_FAILED_ATTEMPTS) {
        bloqueadoHasta = new Date(Date.now() + LOCKOUT_MINUTES * 60000);
      }

      await db.query(
        'UPDATE usuarios SET login_intentos = ?, bloqueado_hasta = ? WHERE id = ?',
        [intentos, bloqueadoHasta, user.id]
      );

      await this.recordAudit({
        usuarioId: user.id,
        email: emailNorm,
        negocioId: user.negocio_id,
        accion: 'LOGIN',
        resultado: 'fallido',
        detalle: `Contraseña incorrecta (Intento ${intentos}/${MAX_FAILED_ATTEMPTS})`,
        ip,
        userAgent
      });

      const error = new Error(
        bloqueadoHasta
          ? `Límite de intentos superado. Cuenta bloqueada por ${LOCKOUT_MINUTES} minutos.`
          : 'Credenciales inválidas'
      );
      error.statusCode = 401;
      throw error;
    }

    // Login exitoso: reiniciar contador
    await db.query(
      'UPDATE usuarios SET login_intentos = 0, bloqueado_hasta = NULL WHERE id = ?',
      [user.id]
    );

    const jti = crypto.randomUUID();
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        rol: user.rol,
        negocioId: user.negocio_id,
        jti
      },
      process.env.JWT_SECRET || 'dev_jwt_secret_reservas_multinegocio_2026_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await this.recordAudit({
      usuarioId: user.id,
      email: emailNorm,
      negocioId: user.negocio_id,
      accion: 'LOGIN',
      resultado: 'exitoso',
      detalle: 'Inicio de sesión correcto',
      ip,
      userAgent
    });

    return {
      token,
      usuario: {
        id: user.id,
        negocio_id: user.negocio_id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    };
  }

  async logout({ jti, usuarioId, email, negocioId, ip, userAgent }) {
    if (jti) {
      // Registrar en tokens_revocados con expiración a 8 horas a partir de ahora
      const expiry = new Date(Date.now() + 8 * 3600 * 1000);
      await db.query(
        'INSERT IGNORE INTO tokens_revocados (jti, expiry) VALUES (?, ?)',
        [jti, expiry]
      );
    }

    await this.recordAudit({
      usuarioId,
      email,
      negocioId,
      accion: 'LOGOUT',
      resultado: 'exitoso',
      detalle: 'Sesión cerrada y token revocado',
      ip,
      userAgent
    });

    return { message: 'Sesión finalizada exitosamente' };
  }

  async getProfile(userId) {
    const [rows] = await db.query(
      `SELECT u.id, u.negocio_id, u.nombre, u.email, u.rol, u.telefono, u.dni, u.created_at,
              n.nombre AS negocio_nombre, n.identificador AS negocio_identificador
       FROM usuarios u
       LEFT JOIN negocios n ON u.negocio_id = n.id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      const error = new Error('Usuario no encontrado');
      error.statusCode = 404;
      throw error;
    }

    return rows[0];
  }

  async recordAudit({ usuarioId = null, negocioId = null, email = null, accion, resultado, detalle = null, ip = null, userAgent = null }) {
    try {
      await db.query(
        `INSERT INTO audit_log (negocio_id, usuario_id, email, accion, ip, user_agent, resultado, detalle)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [negocioId, usuarioId, email, accion, ip, userAgent ? userAgent.substring(0, 255) : null, resultado, detalle]
      );
    } catch (err) {
      console.warn('[Audit Warning] Falló registro de auditoría:', err.message);
    }
  }
}

module.exports = new AuthService();
