'use strict';

function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  // Errores de MySQL
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos únicos' });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Entidad de referencia no encontrada o inválida' });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
