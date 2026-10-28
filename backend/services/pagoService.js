'use strict';
const db = require('../db/connection');

class PagoService {
  async getAll({ negocioId = null, estado = null, metodo = null } = {}) {
    let sql = `
      SELECT p.id, p.negocio_id, p.reserva_id, p.monto, p.metodo, p.estado,
             p.tipo_pago, p.referencia, p.reembolso_metodo, p.created_at,
             r.codigo AS reserva_codigo, r.fecha AS reserva_fecha,
             n.nombre AS negocio_nombre, u.nombre AS registrado_por_nombre
      FROM pagos p
      INNER JOIN reservas r ON p.reserva_id = r.id
      INNER JOIN negocios n ON p.negocio_id = n.id
      LEFT JOIN usuarios u ON p.registrado_por = u.id
      WHERE (? IS NULL OR p.negocio_id = ?)
        AND (? IS NULL OR p.estado = ?)
        AND (? IS NULL OR p.metodo = ?)
      ORDER BY p.created_at DESC
    `;
    const [rows] = await db.query(sql, [
      negocioId, negocioId,
      estado, estado,
      metodo, metodo
    ]);
    return rows;
  }

  async getById(id) {
    const [rows] = await db.query(
      `SELECT p.id, p.negocio_id, p.reserva_id, p.monto, p.metodo, p.estado,
              p.tipo_pago, p.referencia, p.reembolso_metodo, p.reembolso_confirmado_at,
              p.notas, p.created_at,
              r.codigo AS reserva_codigo, r.fecha AS reserva_fecha, r.hora_inicio, r.hora_fin,
              c.nombre AS cancha_nombre, n.nombre AS negocio_nombre
       FROM pagos p
       INNER JOIN reservas r ON p.reserva_id = r.id
       INNER JOIN canchas c ON r.cancha_id = c.id
       INNER JOIN negocios n ON p.negocio_id = n.id
       WHERE p.id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      const error = new Error('Pago no encontrado');
      error.statusCode = 404;
      throw error;
    }

    const pago = rows[0];

    // Obtener movimientos asociados
    const [movimientos] = await db.query(
      'SELECT id, caja_turno_id, metodo, monto, referencia, created_at FROM pagos_movimientos WHERE pago_id = ?',
      [id]
    );
    pago.movimientos = movimientos;

    // Obtener comprobante si existe
    const [comprobante] = await db.query(
      'SELECT id, tipo, numero, created_at FROM comprobantes WHERE pago_id = ? LIMIT 1',
      [id]
    );
    pago.comprobante = comprobante.length > 0 ? comprobante[0] : null;

    return pago;
  }

  async create({ negocioId, reservaId, monto, metodo, tipoPago = 'completo', referencia = null, notas = null, cajaTurnoId = null, registradoPor = null, emitirComprobante = false, tipoComprobante = 'boleta' }) {
    if (!negocioId || !reservaId || !monto || !metodo) {
      const error = new Error('Negocio, reserva, monto y método de pago son requeridos');
      error.statusCode = 400;
      throw error;
    }

    // Verificar si la reserva ya cuenta con un pago
    const [existing] = await db.query('SELECT id FROM pagos WHERE reserva_id = ? LIMIT 1', [reservaId]);
    if (existing.length > 0) {
      const error = new Error('Esta reserva ya cuenta con un registro de pago');
      error.statusCode = 409;
      throw error;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Insertar cabecera de pago
      const [pagoResult] = await connection.query(
        `INSERT INTO pagos (
          negocio_id, reserva_id, monto, metodo, estado,
          tipo_pago, referencia, registrado_por, notas
        ) VALUES (?, ?, ?, ?, 'pagado', ?, ?, ?, ?)`,
        [
          negocioId,
          reservaId,
          monto,
          metodo,
          tipoPago,
          referencia,
          registradoPor,
          notas
        ]
      );
      const pagoId = pagoResult.insertId;

      // 2. Registrar movimiento de pago
      await connection.query(
        `INSERT INTO pagos_movimientos (
          negocio_id, pago_id, caja_turno_id, metodo, monto, referencia, registrado_por
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [negocioId, pagoId, cajaTurnoId || null, metodo, monto, referencia, registradoPor]
      );

      // 3. Emitir comprobante si se solicitó
      if (emitirComprobante) {
        const correlativo = `${tipoComprobante === 'factura' ? 'F' : 'B'}-${negocioId}-${Date.now().toString().slice(-6)}`;
        await connection.query(
          `INSERT INTO comprobantes (negocio_id, pago_id, reserva_id, tipo, numero)
           VALUES (?, ?, ?, ?, ?)`,
          [negocioId, pagoId, reservaId, tipoComprobante, correlativo]
        );
      }

      await connection.commit();
      return this.getById(pagoId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async processRefund(pagoId, { metodo = 'efectivo', canceladoPorId }) {
    const pago = await this.getById(pagoId);

    if (pago.estado === 'reembolsado') {
      const error = new Error('Este pago ya ha sido reembolsado');
      error.statusCode = 400;
      throw error;
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Actualizar estado del pago
      await connection.query(
        `UPDATE pagos
         SET estado = 'reembolsado', reembolso_metodo = ?, reembolso_confirmado_at = NOW()
         WHERE id = ?`,
        [metodo, pagoId]
      );

      // 2. Si tenía comprobante, emitir nota de crédito
      if (pago.comprobante) {
        const numeroNC = `NC-${pago.negocio_id}-${Date.now().toString().slice(-6)}`;
        await connection.query(
          `INSERT INTO notas_credito (negocio_id, comprobante_id, reserva_id, numero, monto, cancelado_por)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [pago.negocio_id, pago.comprobante.id, pago.reserva_id, numeroNC, pago.monto, canceladoPorId]
        );
      }

      // 3. Actualizar estado de la reserva
      await connection.query(
        `UPDATE reservas SET estado = 'cancelada', cancelado_por = ?, cancelado_at = NOW() WHERE id = ?`,
        [canceladoPorId, pago.reserva_id]
      );

      await connection.commit();
      return this.getById(pagoId);
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

module.exports = new PagoService();
