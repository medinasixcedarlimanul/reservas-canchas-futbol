'use strict';
const crypto = require('crypto');
const db = require('../db/connection');
const emailService = require('./emailService');

class ReservaService {
  async getAll({ negocioId = null, usuarioId = null, fecha = null, estado = null } = {}) {
    let sql = `
      SELECT r.id, r.negocio_id, r.codigo, r.cancha_id, r.usuario_id, r.fecha,
             r.hora_inicio, r.hora_fin, r.estado, r.origen, r.notas,
             r.cliente_nombre, r.cliente_dni, r.cancelado_at, r.checkin_at, r.created_at,
             c.nombre AS cancha_nombre, d.nombre AS deporte_nombre,
             n.nombre AS negocio_nombre, u.nombre AS usuario_nombre, u.email AS usuario_email
      FROM reservas r
      INNER JOIN canchas c ON r.cancha_id = c.id
      INNER JOIN deportes d ON c.deporte_id = d.id
      INNER JOIN negocios n ON r.negocio_id = n.id
      INNER JOIN usuarios u ON r.usuario_id = u.id
      WHERE (? IS NULL OR r.negocio_id = ?)
        AND (? IS NULL OR r.usuario_id = ?)
        AND (? IS NULL OR r.fecha = ?)
        AND (? IS NULL OR r.estado = ?)
      ORDER BY r.fecha DESC, r.hora_inicio DESC
    `;
    const params = [
      negocioId, negocioId,
      usuarioId, usuarioId,
      fecha, fecha,
      estado, estado
    ];

    const [rows] = await db.query(sql, params);
    return rows;
  }

  async getById(id) {
    const sql = `
      SELECT r.id, r.negocio_id, r.codigo, r.cancha_id, r.usuario_id, r.fecha,
             r.hora_inicio, r.hora_fin, r.estado, r.origen, r.notas,
             r.cliente_nombre, r.cliente_dni, r.cancelado_por, r.cancelado_at,
             r.checkin_at, r.checkin_por, r.created_at,
             c.nombre AS cancha_nombre, c.precio_hora,
             d.nombre AS deporte_nombre, n.nombre AS negocio_nombre,
             u.nombre AS usuario_nombre, u.email AS usuario_email
      FROM reservas r
      INNER JOIN canchas c ON r.cancha_id = c.id
      INNER JOIN deportes d ON c.deporte_id = d.id
      INNER JOIN negocios n ON r.negocio_id = n.id
      INNER JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.id = ? LIMIT 1
    `;
    const [rows] = await db.query(sql, [id]);
    if (rows.length === 0) {
      const error = new Error('Reserva no encontrada');
      error.statusCode = 404;
      throw error;
    }
    return rows[0];
  }

  async getByCode(codigo) {
    const [rows] = await db.query('SELECT id FROM reservas WHERE codigo = ? LIMIT 1', [codigo]);
    if (rows.length === 0) {
      const error = new Error('Reserva con este código no encontrada');
      error.statusCode = 404;
      throw error;
    }
    return this.getById(rows[0].id);
  }

  async create({ negocioId, canchaId, usuarioId, fecha, horaInicio, horaFin, origen = 'linea', notas = null, clienteNombre = null, clienteDni = null }) {
    if (!negocioId || !canchaId || !usuarioId || !fecha || !horaInicio || !horaFin) {
      const error = new Error('Negocio, cancha, usuario, fecha y horarios son obligatorios');
      error.statusCode = 400;
      throw error;
    }

    // Validar conflicto de horario en la cancha
    const [conflictos] = await db.query(
      `SELECT id FROM reservas
       WHERE cancha_id = ? AND fecha = ? AND hora_inicio = ? AND estado NOT IN ('cancelada')
       LIMIT 1`,
      [canchaId, fecha, horaInicio]
    );

    if (conflictos.length > 0) {
      const error = new Error('El horario seleccionado ya se encuentra reservado');
      error.statusCode = 409;
      throw error;
    }

    const codigo = `RES-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const [result] = await db.query(
      `INSERT INTO reservas (
        negocio_id, codigo, cancha_id, usuario_id, fecha,
        hora_inicio, hora_fin, estado, origen, notas,
        cliente_nombre, cliente_dni
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada', ?, ?, ?, ?)`,
      [
        negocioId,
        codigo,
        canchaId,
        usuarioId,
        fecha,
        horaInicio,
        horaFin,
        origen,
        notas,
        clienteNombre,
        clienteDni
      ]
    );

    const nuevaReserva = await this.getById(result.insertId);

    // Notificación por correo asíncrona (no bloqueante)
    if (nuevaReserva.usuario_email) {
      emailService.enviarConfirmacionReserva({
        email: nuevaReserva.usuario_email,
        clienteNombre: nuevaReserva.cliente_nombre || nuevaReserva.usuario_nombre,
        negocioNombre: nuevaReserva.negocio_nombre,
        codigoReserva: nuevaReserva.codigo,
        canchaNombre: nuevaReserva.cancha_nombre,
        fecha: nuevaReserva.fecha instanceof Date ? nuevaReserva.fecha.toISOString().split('T')[0] : nuevaReserva.fecha,
        horaInicio: nuevaReserva.hora_inicio,
        horaFin: nuevaReserva.hora_fin,
        montoTotal: nuevaReserva.precio_hora || 0,
        montoPagado: 0,
        saldoPendiente: nuevaReserva.precio_hora || 0
      }).catch(err => console.error('⚠️ [Email Error al crear reserva]:', err.message));
    }

    return nuevaReserva;
  }

  async cancel(id, { canceladoPorId, rol }) {
    const reserva = await this.getById(id);

    if (reserva.estado === 'cancelada') {
      const error = new Error('La reserva ya ha sido cancelada previamente');
      error.statusCode = 400;
      throw error;
    }

    // Si es cliente, solo puede cancelar sus propias reservas
    if (rol === 'cliente' && reserva.usuario_id !== canceladoPorId) {
      const error = new Error('No tienes permisos para cancelar esta reserva');
      error.statusCode = 403;
      throw error;
    }

    await db.query(
      `UPDATE reservas
       SET estado = 'cancelada', cancelado_por = ?, cancelado_at = NOW()
       WHERE id = ?`,
      [canceladoPorId, id]
    );

    const cancelada = await this.getById(id);

    // Notificación por correo asíncrona de cancelación
    if (cancelada.usuario_email) {
      emailService.enviarCancelacionReserva({
        email: cancelada.usuario_email,
        clienteNombre: cancelada.cliente_nombre || cancelada.usuario_nombre,
        negocioNombre: cancelada.negocio_nombre,
        codigoReserva: cancelada.codigo,
        canchaNombre: cancelada.cancha_nombre,
        fecha: cancelada.fecha instanceof Date ? cancelada.fecha.toISOString().split('T')[0] : cancelada.fecha,
        horaInicio: cancelada.hora_inicio,
        horaFin: cancelada.hora_fin
      }).catch(err => console.error('⚠️ [Email Error al cancelar reserva]:', err.message));
    }

    return cancelada;
  }

  async checkIn(id, recepcionistaId) {
    const reserva = await this.getById(id);

    if (reserva.estado === 'cancelada') {
      const error = new Error('No es posible realizar check-in de una reserva cancelada');
      error.statusCode = 400;
      throw error;
    }

    await db.query(
      `UPDATE reservas
       SET checkin_at = NOW(), checkin_por = ?, estado = 'completada'
       WHERE id = ?`,
      [recepcionistaId, id]
    );

    return this.getById(id);
  }
}

module.exports = new ReservaService();
