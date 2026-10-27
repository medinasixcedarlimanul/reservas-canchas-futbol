'use strict';
const crypto = require('crypto');
const db = require('../db/connection');

class CuponService {
  async getAll({ negocioId = null, estado = null } = {}) {
    const [rows] = await db.query(
      `SELECT c.id, c.negocio_id, c.codigo, c.valor_inicial, c.saldo, c.motivo,
              c.reserva_origen_id, c.estado, c.created_at,
              n.nombre AS negocio_nombre, u.nombre AS generado_por_nombre,
              r.codigo AS reserva_origen_codigo
       FROM cupones c
       INNER JOIN negocios n ON c.negocio_id = n.id
       INNER JOIN usuarios u ON c.generado_por = u.id
       INNER JOIN reservas r ON c.reserva_origen_id = r.id
       WHERE (? IS NULL OR c.negocio_id = ?)
         AND (? IS NULL OR c.estado = ?)
       ORDER BY c.created_at DESC`,
      [negocioId, negocioId, estado, estado]
    );
    return rows;
  }

  async getById(id) {
    const [rows] = await db.query(
      `SELECT c.id, c.negocio_id, c.codigo, c.valor_inicial, c.saldo, c.motivo,
              c.reserva_origen_id, c.estado, c.created_at,
              n.nombre AS negocio_nombre, u.nombre AS generado_por_nombre,
              r.codigo AS reserva_origen_codigo
       FROM cupones c
       INNER JOIN negocios n ON c.negocio_id = n.id
       INNER JOIN usuarios u ON c.generado_por = u.id
       INNER JOIN reservas r ON c.reserva_origen_id = r.id
       WHERE c.id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      const error = new Error('Cupón no encontrado');
      error.statusCode = 404;
      throw error;
    }

    const cupon = rows[0];
    const [movimientos] = await db.query(
      `SELECT cm.id, cm.reserva_id, cm.monto, cm.tipo, cm.created_at,
              u.nombre AS registrado_por_nombre, r.codigo AS reserva_codigo
       FROM cupones_movimientos cm
       LEFT JOIN usuarios u ON cm.registrado_por = u.id
       LEFT JOIN reservas r ON cm.reserva_id = r.id
       WHERE cm.cupon_id = ?
       ORDER BY cm.created_at ASC`,
      [id]
    );
    cupon.movimientos = movimientos;
    return cupon;
  }

  async validateCoupon(codigo, negocioId) {
    const [rows] = await db.query(
      `SELECT id, codigo, valor_inicial, saldo, estado, motivo
       FROM cupones
       WHERE codigo = ? AND negocio_id = ? LIMIT 1`,
      [codigo.trim().toUpperCase(), negocioId]
    );

    if (rows.length === 0) {
      const error = new Error('Cupón no encontrado o inválido para este negocio');
      error.statusCode = 404;
      throw error;
    }

    const cupon = rows[0];
    if (cupon.estado !== 'activo' || parseFloat(cupon.saldo) <= 0) {
      const error = new Error('El cupón se encuentra agotado o inactivo');
      error.statusCode = 400;
      throw error;
    }

    return cupon;
  }

  async create({ negocioId, valorInicial, motivo, reservaOrigenId, generadoPor }) {
    if (!negocioId || !valorInicial || !motivo || !reservaOrigenId || !generadoPor) {
      const error = new Error('Negocio, valor inicial, motivo, reserva y usuario emisor son obligatorios');
      error.statusCode = 400;
      throw error;
    }

    const codigo = `CUP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO cupones (negocio_id, codigo, valor_inicial, saldo, motivo, reserva_origen_id, generado_por, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'activo')`,
        [negocioId, codigo, valorInicial, valorInicial, motivo.trim(), reservaOrigenId, generadoPor]
      );
      const cuponId = result.insertId;

      // Registrar movimiento de emisión
      await connection.query(
        `INSERT INTO cupones_movimientos (cupon_id, reserva_id, monto, tipo, registrado_por)
         VALUES (?, ?, ?, 'emision', ?)`,
        [cuponId, reservaOrigenId, valorInicial, generadoPor]
      );

      await connection.commit();
      return this.getById(cuponId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async redeem(cuponId, { reservaId, monto, registradoPor }) {
    const cupon = await this.getById(cuponId);

    if (cupon.estado !== 'activo' || parseFloat(cupon.saldo) < parseFloat(monto)) {
      const error = new Error('Saldo insuficiente en el cupón o cupón inactivo');
      error.statusCode = 400;
      throw error;
    }

    const nuevoSaldo = parseFloat(cupon.saldo) - parseFloat(monto);
    const nuevoEstado = nuevoSaldo <= 0 ? 'agotado' : 'activo';

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        'UPDATE cupones SET saldo = ?, estado = ? WHERE id = ?',
        [nuevoSaldo, nuevoEstado, cuponId]
      );

      await connection.query(
        `INSERT INTO cupones_movimientos (cupon_id, reserva_id, monto, tipo, registrado_por)
         VALUES (?, ?, ?, 'canje', ?)`,
        [cuponId, reservaId || null, monto, registradoPor]
      );

      await connection.commit();
      return this.getById(cuponId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

module.exports = new CuponService();
