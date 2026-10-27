'use strict';
const db = require('../db/connection');

class ReporteService {
  async getDashboard({ negocioId, desde, hasta }) {
    if (!negocioId) {
      const error = new Error('El ID de negocio es requerido para consultar métricas');
      error.statusCode = 400;
      throw error;
    }

    const fechaDesde = desde || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const fechaHasta = hasta || new Date().toISOString().split('T')[0];

    // 1. Total y desglose de reservas por estado
    const [reservasPorEstado] = await db.query(
      `SELECT estado, COUNT(*) AS total
       FROM reservas
       WHERE negocio_id = ? AND fecha BETWEEN ? AND ?
       GROUP BY estado`,
      [negocioId, fechaDesde, fechaHasta]
    );

    // 2. Total de ingresos y por método de pago
    const [ingresosPorMetodo] = await db.query(
      `SELECT pm.metodo, COALESCE(SUM(pm.monto), 0) AS total, COUNT(*) AS transacciones
       FROM pagos_movimientos pm
       INNER JOIN pagos p ON pm.pago_id = p.id
       WHERE pm.negocio_id = ? AND DATE(pm.created_at) BETWEEN ? AND ?
       GROUP BY pm.metodo`,
      [negocioId, fechaDesde, fechaHasta]
    );

    const totalIngresos = ingresosPorMetodo.reduce((acc, curr) => acc + parseFloat(curr.total || 0), 0);

    // 3. Top canchas más reservadas
    const [canchasOcupacion] = await db.query(
      `SELECT c.id, c.nombre, COUNT(r.id) AS total_reservas,
              COALESCE(SUM(p.monto), 0) AS ingresos_generados
       FROM canchas c
       LEFT JOIN reservas r ON c.id = r.cancha_id AND r.fecha BETWEEN ? AND ? AND r.estado NOT IN ('cancelada')
       LEFT JOIN pagos p ON r.id = p.reserva_id
       WHERE c.negocio_id = ?
       GROUP BY c.id, c.nombre
       ORDER BY total_reservas DESC`,
      [fechaDesde, fechaHasta, negocioId]
    );

    // 4. Presupuesto o balance base del mes actual
    const [cajaMes] = await db.query(
      `SELECT monto_inicial FROM caja_mensual
       WHERE negocio_id = ? AND anio = YEAR(?) AND mes = MONTH(?) LIMIT 1`,
      [negocioId, fechaDesde, fechaDesde]
    );

    return {
      negocio_id: negocioId,
      rango: { desde: fechaDesde, hasta: fechaHasta },
      kpis: {
        total_ingresos: totalIngresos,
        total_reservas: reservasPorEstado.reduce((acc, curr) => acc + parseInt(curr.total, 10), 0),
        monto_inicial_mes: cajaMes.length > 0 ? parseFloat(cajaMes[0].monto_inicial) : 0
      },
      reservas_por_estado: reservasPorEstado,
      ingresos_por_metodo: ingresosPorMetodo,
      canchas_rendimiento: canchasOcupacion
    };
  }
}

module.exports = new ReporteService();
