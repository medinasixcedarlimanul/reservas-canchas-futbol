'use strict';
const db = require('../db/connection');

class CanchaService {
  async getAll({ negocioId = null, deporteId = null, activo = true } = {}) {
    let sql = `
      SELECT c.id, c.negocio_id, c.deporte_id, c.nombre, c.descripcion, c.capacidad,
             c.precio_hora, c.hora_apertura, c.hora_cierre, c.activo,
             n.nombre AS negocio_nombre, d.nombre AS deporte_nombre
      FROM canchas c
      INNER JOIN negocios n ON c.negocio_id = n.id
      INNER JOIN deportes d ON c.deporte_id = d.id
      WHERE (? IS NULL OR c.negocio_id = ?)
        AND (? IS NULL OR c.deporte_id = ?)
        AND (? IS NULL OR c.activo = ?)
      ORDER BY c.nombre ASC
    `;
    const params = [
      negocioId, negocioId,
      deporteId, deporteId,
      activo === undefined ? null : activo, activo
    ];

    const [rows] = await db.query(sql, params);
    return rows;
  }

  async getById(id) {
    const sql = `
      SELECT c.id, c.negocio_id, c.deporte_id, c.nombre, c.descripcion, c.capacidad,
             c.precio_hora, c.hora_apertura, c.hora_cierre, c.activo,
             n.nombre AS negocio_nombre, d.nombre AS deporte_nombre
      FROM canchas c
      INNER JOIN negocios n ON c.negocio_id = n.id
      INNER JOIN deportes d ON c.deporte_id = d.id
      WHERE c.id = ? LIMIT 1
    `;
    const [rows] = await db.query(sql, [id]);
    if (rows.length === 0) {
      const error = new Error('Cancha no encontrada');
      error.statusCode = 404;
      throw error;
    }
    return rows[0];
  }

  async create({ negocioId, deporteId, nombre, descripcion, capacidad, precioHora, horaApertura, horaCierre }) {
    if (!negocioId || !deporteId || !nombre || !precioHora) {
      const error = new Error('Negocio, deporte, nombre y precio por hora son obligatorios');
      error.statusCode = 400;
      throw error;
    }

    const [result] = await db.query(
      `INSERT INTO canchas (negocio_id, deporte_id, nombre, descripcion, capacidad, precio_hora, hora_apertura, hora_cierre, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        negocioId,
        deporteId,
        nombre.trim(),
        descripcion || null,
        capacidad || 10,
        precioHora,
        horaApertura || '07:00:00',
        horaCierre || '23:00:00'
      ]
    );

    return this.getById(result.insertId);
  }

  async update(id, data) {
    const cancha = await this.getById(id);

    await db.query(
      `UPDATE canchas
       SET nombre = COALESCE(?, nombre),
           descripcion = COALESCE(?, descripcion),
           capacidad = COALESCE(?, capacidad),
           precio_hora = COALESCE(?, precio_hora),
           hora_apertura = COALESCE(?, hora_apertura),
           hora_cierre = COALESCE(?, hora_cierre),
           activo = COALESCE(?, activo)
       WHERE id = ?`,
      [
        data.nombre ? data.nombre.trim() : null,
        data.descripcion,
        data.capacidad,
        data.precioHora,
        data.horaApertura,
        data.horaCierre,
        data.activo,
        id
      ]
    );

    return this.getById(id);
  }

  async getAvailability(canchaId, fecha) {
    if (!fecha) {
      const error = new Error('La fecha (YYYY-MM-DD) es obligatoria');
      error.statusCode = 400;
      throw error;
    }

    const cancha = await this.getById(canchaId);

    // Obtener reservas activas en esa cancha y fecha (confirmadas o pendientes)
    const [reservas] = await db.query(
      `SELECT id, hora_inicio, hora_fin, estado
       FROM reservas
       WHERE cancha_id = ? AND fecha = ? AND estado NOT IN ('cancelada')
       ORDER BY hora_inicio ASC`,
      [canchaId, fecha]
    );

    const aperturaHora = parseInt(cancha.hora_apertura.split(':')[0], 10);
    const cierreHora = parseInt(cancha.hora_cierre.split(':')[0], 10);

    const slots = [];
    for (let h = aperturaHora; h < cierreHora; h++) {
      const inicio = `${String(h).padStart(2, '0')}:00:00`;
      const fin = `${String(h + 1).padStart(2, '0')}:00:00`;

      const ocupado = reservas.find((r) => r.hora_inicio === inicio);

      slots.push({
        hora_inicio: inicio,
        hora_fin: fin,
        disponible: !ocupado,
        reserva_id: ocupado ? ocupado.id : null,
        estado_reserva: ocupado ? ocupado.estado : null
      });
    }

    return {
      cancha: {
        id: cancha.id,
        nombre: cancha.nombre,
        precio_hora: cancha.precio_hora,
        negocio_id: cancha.negocio_id
      },
      fecha,
      slots
    };
  }
}

module.exports = new CanchaService();
