'use strict';
const db = require('../db/connection');

class CajaService {
  async getActiveTurno(negocioId, abiertaPorId = null) {
    const [rows] = await db.query(
      `SELECT id, negocio_id, estado, monto_inicial, abierta_por, nombre_recepcionista,
              abierta_at, created_at
       FROM caja_turnos
       WHERE negocio_id = ? AND estado = 'abierta'
         AND (? IS NULL OR abierta_por = ?)
       ORDER BY abierta_at DESC LIMIT 1`,
      [negocioId, abiertaPorId, abiertaPorId]
    );

    if (rows.length === 0) {
      return null;
    }

    const turno = rows[0];

    // Calcular ingresos acumulados en este turno por método
    const [resumen] = await db.query(
      `SELECT metodo, SUM(monto) AS total, COUNT(*) AS cantidad
       FROM pagos_movimientos
       WHERE caja_turno_id = ?
       GROUP BY metodo`,
      [turno.id]
    );

    turno.resumen_metodos = resumen;
    return turno;
  }

  async openTurno({ negocioId, abiertaPorId, montoInicial = 0, nombreRecepcionista = null }) {
    if (!negocioId || !abiertaPorId) {
      const error = new Error('Negocio y usuario son obligatorios para abrir caja');
      error.statusCode = 400;
      throw error;
    }

    // Comprobar si ya existe un turno abierto para este usuario en el negocio
    const activo = await this.getActiveTurno(negocioId, abiertaPorId);
    if (activo) {
      const error = new Error('Ya tienes un turno de caja abierto en este negocio');
      error.statusCode = 409;
      throw error;
    }

    const [result] = await db.query(
      `INSERT INTO caja_turnos (
        negocio_id, estado, monto_inicial, abierta_por, nombre_recepcionista, abierta_at
      ) VALUES (?, 'abierta', ?, ?, ?, NOW())`,
      [negocioId, montoInicial, abiertaPorId, nombreRecepcionista]
    );

    return this.getTurnoById(result.insertId);
  }

  async closeTurno(turnoId, { cerradaPorId, efectivoContado = 0, notasCierre = null }) {
    const turno = await this.getTurnoById(turnoId);

    if (turno.estado === 'cerrada') {
      const error = new Error('Este turno de caja ya se encuentra cerrado');
      error.statusCode = 400;
      throw error;
    }

    // Calcular efectivo total esperado (monto inicial + cobros en efectivo)
    const [efectivoRows] = await db.query(
      `SELECT COALESCE(SUM(monto), 0) AS total_efectivo
       FROM pagos_movimientos
       WHERE caja_turno_id = ? AND metodo = 'efectivo'`,
      [turnoId]
    );

    const cobrosEfectivo = parseFloat(efectivoRows[0].total_efectivo || 0);
    const montoInicial = parseFloat(turno.monto_inicial || 0);
    const efectivoEsperado = montoInicial + cobrosEfectivo;
    const contado = parseFloat(efectivoContado || 0);
    const diferencia = contado - efectivoEsperado;

    await db.query(
      `UPDATE caja_turnos
       SET estado = 'cerrada',
           cerrada_por = ?,
           cerrada_at = NOW(),
           efectivo_esperado = ?,
           efectivo_contado = ?,
           diferencia = ?,
           notas_cierre = ?
       WHERE id = ?`,
      [cerradaPorId, efectivoEsperado, contado, diferencia, notasCierre, turnoId]
    );

    return this.getTurnoById(turnoId);
  }

  async getTurnoById(id) {
    const [rows] = await db.query(
      `SELECT t.*, u1.nombre AS abierta_por_nombre, u2.nombre AS cerrada_por_nombre,
              n.nombre AS negocio_nombre
       FROM caja_turnos t
       INNER JOIN negocios n ON t.negocio_id = n.id
       LEFT JOIN usuarios u1 ON t.abierta_por = u1.id
       LEFT JOIN usuarios u2 ON t.cerrada_por = u2.id
       WHERE t.id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      const error = new Error('Turno de caja no encontrado');
      error.statusCode = 404;
      throw error;
    }

    const turno = rows[0];

    const [movimientos] = await db.query(
      `SELECT pm.id, pm.pago_id, pm.metodo, pm.monto, pm.referencia, pm.created_at,
              r.codigo AS reserva_codigo
       FROM pagos_movimientos pm
       INNER JOIN pagos p ON pm.pago_id = p.id
       INNER JOIN reservas r ON p.reserva_id = r.id
       WHERE pm.caja_turno_id = ?
       ORDER BY pm.created_at ASC`,
      [id]
    );

    turno.movimientos = movimientos;
    return turno;
  }

  async getHistorial({ negocioId, limit = 30 }) {
    const [rows] = await db.query(
      `SELECT t.id, t.negocio_id, t.estado, t.monto_inicial, t.abierta_at, t.cerrada_at,
              t.efectivo_esperado, t.efectivo_contado, t.diferencia,
              u1.nombre AS abierta_por_nombre, u2.nombre AS cerrada_por_nombre
       FROM caja_turnos t
       LEFT JOIN usuarios u1 ON t.abierta_por = u1.id
       LEFT JOIN usuarios u2 ON t.cerrada_por = u2.id
       WHERE (? IS NULL OR t.negocio_id = ?)
       ORDER BY t.abierta_at DESC LIMIT ?`,
      [negocioId, negocioId, parseInt(limit, 10)]
    );
    return rows;
  }
}

module.exports = new CajaService();
