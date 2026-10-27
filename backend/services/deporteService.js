'use strict';
const db = require('../db/connection');

class DeporteService {
  async getAll({ activo = true } = {}) {
    const [rows] = await db.query(
      `SELECT id, nombre, descripcion, activo, created_at
       FROM deportes WHERE (? IS NULL OR activo = ?) ORDER BY nombre ASC`,
      [activo === undefined ? null : activo, activo]
    );
    return rows;
  }

  async getById(id) {
    const [rows] = await db.query(
      'SELECT id, nombre, descripcion, activo, created_at FROM deportes WHERE id = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) {
      const error = new Error('Disciplina deportiva no encontrada');
      error.statusCode = 404;
      throw error;
    }
    return rows[0];
  }

  async create({ nombre, descripcion }) {
    if (!nombre) {
      const error = new Error('El nombre de la disciplina es obligatorio');
      error.statusCode = 400;
      throw error;
    }

    const [existing] = await db.query('SELECT id FROM deportes WHERE nombre = ? LIMIT 1', [nombre.trim()]);
    if (existing.length > 0) {
      const error = new Error('Esta disciplina deportiva ya está registrada');
      error.statusCode = 409;
      throw error;
    }

    const [result] = await db.query(
      'INSERT INTO deportes (nombre, descripcion, activo) VALUES (?, ?, TRUE)',
      [nombre.trim(), descripcion || null]
    );

    return this.getById(result.insertId);
  }
}

module.exports = new DeporteService();
