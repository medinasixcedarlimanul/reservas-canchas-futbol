'use strict';
const db = require('../db/connection');

class NegocioService {
  async getAll({ activo = true } = {}) {
    const [rows] = await db.query(
      `SELECT id, nombre, identificador, telefono, email, direccion, activo, created_at
       FROM negocios WHERE (? IS NULL OR activo = ?) ORDER BY nombre ASC`,
      [activo === undefined ? null : activo, activo]
    );
    return rows;
  }

  async getById(id) {
    const [rows] = await db.query(
      `SELECT id, nombre, identificador, telefono, email, direccion, activo, created_at, updated_at
       FROM negocios WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      const error = new Error('Negocio no encontrado');
      error.statusCode = 404;
      throw error;
    }
    return rows[0];
  }

  async create({ nombre, identificador, telefono, email, direccion }) {
    if (!nombre || !identificador) {
      const error = new Error('Nombre e identificador son obligatorios');
      error.statusCode = 400;
      throw error;
    }

    const slug = identificador.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    const [existing] = await db.query('SELECT id FROM negocios WHERE identificador = ? LIMIT 1', [slug]);
    if (existing.length > 0) {
      const error = new Error('Ya existe un negocio con este identificador');
      error.statusCode = 409;
      throw error;
    }

    const [result] = await db.query(
      `INSERT INTO negocios (nombre, identificador, telefono, email, direccion, activo)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [nombre.trim(), slug, telefono || null, email || null, direccion || null]
    );

    return this.getById(result.insertId);
  }

  async update(id, { nombre, telefono, email, direccion, activo }) {
    const negocio = await this.getById(id);

    await db.query(
      `UPDATE negocios
       SET nombre = COALESCE(?, nombre),
           telefono = COALESCE(?, telefono),
           email = COALESCE(?, email),
           direccion = COALESCE(?, direccion),
           activo = COALESCE(?, activo)
       WHERE id = ?`,
      [nombre ? nombre.trim() : null, telefono, email, direccion, activo !== undefined ? activo : null, id]
    );

    return this.getById(id);
  }
}

module.exports = new NegocioService();
