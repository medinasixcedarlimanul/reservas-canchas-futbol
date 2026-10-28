'use strict';
const crypto = require('crypto');
const db = require('../db/connection');
const emailService = require('./emailService');

/**
 * Servicio de Pasarela de Pagos Online Multi-Tenant
 * Soporta:
 *  - Flow (Chile / Internacional)
 *  - Stripe (Tarjetas Globales)
 *  - Mock Simulator (para pruebas locales y desarrollo sin credenciales)
 */
class PasarelaPagoService {
  constructor() {
    this.provider = (process.env.PAYMENT_GATEWAY_PROVIDER || 'mock').toLowerCase();
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';
    
    // Configuración Flow
    this.flowApiKey = process.env.FLOW_API_KEY || '';
    this.flowSecret = process.env.FLOW_SECRET_KEY || '';
    this.flowEnv = process.env.FLOW_ENV || 'sandbox';
    this.flowBaseUrl = this.flowEnv === 'production' 
      ? 'https://www.flow.cl/api' 
      : 'https://sandbox.flow.cl/api';

    // Configuración Stripe
    this.stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
  }

  /**
   * Genera la firma HMAC SHA256 requerida por Flow
   */
  _signFlowParams(params) {
    const keys = Object.keys(params).sort();
    let toSign = '';
    for (const key of keys) {
      toSign += `${key}${params[key]}`;
    }
    return crypto.createHmac('sha256', this.flowSecret).update(toSign).digest('hex');
  }

  /**
   * Inicia una orden de pago en línea bloqueando temporalmente el horario
   */
  async iniciarPago({
    negocioId,
    usuarioId,
    canchaId,
    fecha,
    horaInicio,
    horaFin,
    clienteNombre,
    clienteDni,
    clienteEmail,
    notas,
    monto,
    tipoPago = 'completo', // 'completo' | 'adelanto'
    cuponCodigo = null,
    cuponMonto = 0
  }) {
    // 1. Validar que la cancha exista y esté disponible
    const [canchaRows] = await db.query(
      'SELECT id, nombre, precio_por_hora, estado FROM canchas WHERE id = ? AND negocio_id = ?',
      [canchaId, negocioId]
    );
    if (canchaRows.length === 0) {
      const err = new Error('Cancha deportiva no encontrada o inactiva');
      err.statusCode = 404;
      throw err;
    }
    const cancha = canchaRows[0];
    if (cancha.estado !== 'disponible') {
      const err = new Error(`La cancha no está disponible (Estado: ${cancha.estado})`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Validar que no haya colisión con una reserva confirmada
    const [solapadaReserva] = await db.query(
      `SELECT id FROM reservas 
       WHERE cancha_id = ? AND fecha = ? AND estado NOT IN ('cancelada')
         AND hora_inicio < ? AND hora_fin > ? LIMIT 1`,
      [canchaId, fecha, horaFin, horaInicio]
    );
    if (solapadaReserva.length > 0) {
      const err = new Error('El horario seleccionado ya se encuentra reservado por otro usuario');
      err.statusCode = 409;
      throw err;
    }

    // 3. Validar que no haya una reserva pendiente activa (bloqueo temporal de 15 minutos)
    const [solapadaPendiente] = await db.query(
      `SELECT id FROM reservas_pendientes_pago
       WHERE cancha_id = ? AND fecha = ? AND estado = 'pendiente'
         AND created_at >= NOW() - INTERVAL 15 MINUTE
         AND hora_inicio < ? AND hora_fin > ? LIMIT 1`,
      [canchaId, fecha, horaFin, horaInicio]
    );
    if (solapadaPendiente.length > 0) {
      const err = new Error('El horario está temporalmente reservado en pasarela (esperando confirmación de pago, expira en 15 min)');
      err.statusCode = 409;
      throw err;
    }

    // 4. Generar identificadores únicos de transacción
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const gatewayToken = `TOK-${crypto.randomBytes(16).toString('hex')}`;

    // 5. Registrar en reservas_pendientes_pago
    await db.query(
      `INSERT INTO reservas_pendientes_pago 
       (negocio_id, commerce_order, usuario_id, cancha_id, fecha, hora_inicio, hora_fin,
        cliente_nombre, cliente_dni, notas, monto, cupon_codigo, cupon_monto, token, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [
        negocioId, orderNumber, usuarioId, canchaId, fecha, horaInicio, horaFin,
        clienteNombre, clienteDni, notas || null, monto, cuponCodigo || null, cuponMonto || 0,
        gatewayToken
      ]
    );

    // 6. Integración con Pasarela Seleccionada
    // CASO A: FLOW API
    if ((this.provider === 'flow' || this.flowApiKey) && this.flowApiKey && this.flowSecret) {
      try {
        const params = {
          apiKey: this.flowApiKey,
          commerceOrder: orderNumber,
          subject: `Reserva Cancha: ${cancha.nombre}`,
          currency: 'PEN',
          amount: parseFloat(monto).toFixed(2),
          email: clienteEmail || 'cliente@sportreserve.com',
          urlConfirmation: `${this.appUrl}/api/pagos/online/webhook/flow`,
          urlReturn: `${this.appUrl}/api/pagos/online/retorno?order=${orderNumber}`
        };
        params.s = this._signFlowParams(params);

        const formBody = new URLSearchParams(params).toString();
        const response = await fetch(`${this.flowBaseUrl}/payment/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formBody
        });

        const flowData = await response.json();
        if (!response.ok) {
          throw new Error(flowData.message || 'Error en respuesta de Flow API');
        }

        // Actualizar token real de Flow
        await db.query(
          'UPDATE reservas_pendientes_pago SET token = ? WHERE commerce_order = ?',
          [flowData.token, orderNumber]
        );

        return {
          provider: 'flow',
          commerce_order: orderNumber,
          token: flowData.token,
          redirect_url: `${flowData.url}?token=${flowData.token}`
        };
      } catch (err) {
        console.error('❌ [Flow API Error]:', err.message);
        throw new Error(`Error al conectar con pasarela Flow: ${err.message}`);
      }
    }

    // CASO B: STRIPE API
    if ((this.provider === 'stripe' || this.stripeSecretKey) && this.stripeSecretKey) {
      try {
        const stripeParams = new URLSearchParams({
          'payment_method_types[]': 'card',
          'line_items[0][price_data][currency]': 'pen',
          'line_items[0][price_data][product_data][name]': `Reserva Cancha: ${cancha.nombre}`,
          'line_items[0][price_data][unit_amount]': Math.round(parseFloat(monto) * 100),
          'line_items[0][quantity]': '1',
          'mode': 'payment',
          'success_url': `${this.appUrl}/api/pagos/online/retorno?session_id={CHECKOUT_SESSION_ID}&order=${orderNumber}`,
          'cancel_url': `${this.appUrl}/canchas.html`,
          'client_reference_id': orderNumber
        });

        if (clienteEmail) {
          stripeParams.append('customer_email', clienteEmail);
        }

        const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: stripeParams.toString()
        });

        const session = await response.json();
        if (!response.ok) {
          throw new Error(session.error?.message || 'Error al crear Checkout Session en Stripe');
        }

        await db.query(
          'UPDATE reservas_pendientes_pago SET token = ? WHERE commerce_order = ?',
          [session.id, orderNumber]
        );

        return {
          provider: 'stripe',
          commerce_order: orderNumber,
          token: session.id,
          redirect_url: session.url
        };
      } catch (err) {
        console.error('❌ [Stripe API Error]:', err.message);
        throw new Error(`Error al conectar con Stripe: ${err.message}`);
      }
    }

    // CASO C: MOCK SIMULATOR (Por defecto cuando no hay API keys configuradas)
    console.log(`💳 [PAYMENT GATEWAY MOCK] Sesión de pago iniciada. Orden: ${orderNumber}, Token: ${gatewayToken}`);
    return {
      provider: 'mock',
      commerce_order: orderNumber,
      token: gatewayToken,
      redirect_url: `${this.appUrl}/api/pagos/online/sandbox-checkout?token=${gatewayToken}`
    };
  }

  /**
   * Confirma el pago en la pasarela, crea la reserva confirmada y emite el comprobante y email
   */
  async confirmarPago({ token, provider = 'mock', referenciaExterna = null }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Obtener la orden pendiente con bloqueo FOR UPDATE
      const [pendientes] = await conn.query(
        'SELECT * FROM reservas_pendientes_pago WHERE token = ? FOR UPDATE',
        [token]
      );

      if (pendientes.length === 0) {
        throw new Error('Transacción de pago pendiente no encontrada o token inválido');
      }

      const p = pendientes[0];

      if (p.estado === 'confirmado') {
        await conn.commit();
        return {
          ok: true,
          ya_confirmado: true,
          reserva_id: p.reserva_id,
          commerce_order: p.commerce_order
        };
      }

      if (p.estado !== 'pendiente') {
        throw new Error(`La orden de pago se encuentra en estado no procesable: ${p.estado}`);
      }

      // 2. Verificar disponibilidad de horario (por si transcurrieron los 15 min)
      const [conflicto] = await conn.query(
        `SELECT id FROM reservas 
         WHERE cancha_id = ? AND fecha = ? AND estado NOT IN ('cancelada')
           AND hora_inicio < ? AND hora_fin > ? LIMIT 1`,
        [p.cancha_id, p.fecha, p.hora_fin, p.hora_inicio]
      );

      if (conflicto.length > 0) {
        await conn.query(
          "UPDATE reservas_pendientes_pago SET estado = 'conflicto' WHERE id = ?",
          [p.id]
        );
        await conn.commit();
        throw new Error('Conflicto: El horario fue reservado por otro usuario durante el proceso de pago. Se requiere reembolso.');
      }

      // 3. Crear el código único de reserva (ej. RES-2026-001)
      const anio = new Date().getFullYear();
      const [countRows] = await conn.query(
        'SELECT COUNT(*) AS total FROM reservas WHERE YEAR(created_at) = ?',
        [anio]
      );
      const numeroCorrelativo = String(countRows[0].total + 1).padStart(4, '0');
      const codigoReserva = `RES-${anio}-${numeroCorrelativo}`;

      // 4. Insertar la reserva confirmada
      const [reservaResult] = await conn.query(
        `INSERT INTO reservas 
         (negocio_id, codigo, usuario_id, cancha_id, fecha, hora_inicio, hora_fin,
          estado, origen, notas, cliente_nombre, cliente_dni)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada', 'online', ?, ?, ?)`,
        [
          p.negocio_id, codigoReserva, p.usuario_id, p.cancha_id, p.fecha,
          p.hora_inicio, p.hora_fin, p.notas, p.cliente_nombre, p.cliente_dni
        ]
      );
      const reservaId = reservaResult.insertId;

      // 5. Registrar el pago principal
      const metodoPago = provider === 'flow' ? 'flow' : 'tarjeta';
      const refPago = referenciaExterna || p.commerce_order;

      const [pagoResult] = await conn.query(
        `INSERT INTO pagos 
         (negocio_id, reserva_id, monto, metodo, estado, tipo_pago, referencia)
         VALUES (?, ?, ?, ?, 'pagado', 'completo', ?)`,
        [p.negocio_id, reservaId, p.monto, metodoPago, refPago]
      );
      const pagoId = pagoResult.insertId;

      // 6. Registrar movimiento financiero
      await conn.query(
        `INSERT INTO pagos_movimientos 
         (pago_id, negocio_id, caja_turno_id, metodo, monto, referencia)
         VALUES (?, ?, NULL, ?, ?, ?)`,
        [pagoId, p.negocio_id, metodoPago, p.monto, refPago]
      );

      // 7. Emitir comprobante electrónico (Boleta)
      const numeroComprobante = `BOL-${anio}-${String(pagoId).padStart(6, '0')}`;
      await conn.query(
        `INSERT INTO comprobantes 
         (negocio_id, pago_id, reserva_id, tipo, numero, monto)
         VALUES (?, ?, ?, 'boleta', ?, ?)`,
        [p.negocio_id, pagoId, reservaId, numeroComprobante, p.monto]
      );

      // 8. Si usó cupón de descuento, registrar el canje
      if (p.cupon_codigo) {
        const [cuponRows] = await conn.query(
          'SELECT id, usos_actuales FROM cupones WHERE codigo = ? AND negocio_id = ?',
          [p.cupon_codigo, p.negocio_id]
        );
        if (cuponRows.length > 0) {
          const cuponId = cuponRows[0].id;
          await conn.query(
            'UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id = ?',
            [cuponId]
          );
          await conn.query(
            `INSERT INTO cupones_movimientos (cupon_id, reserva_id, monto, tipo)
             VALUES (?, ?, ?, 'canje')`,
            [cuponId, reservaId, p.cupon_monto || 0]
          );
        }
      }

      // 9. Actualizar orden pendiente a 'confirmado'
      await conn.query(
        "UPDATE reservas_pendientes_pago SET estado = 'confirmado', reserva_id = ? WHERE id = ?",
        [reservaId, p.id]
      );

      // 10. Consultar información adicional para el correo
      const [infoNegocio] = await conn.query(
        `SELECT n.nombre AS negocio_nombre, c.nombre AS cancha_nombre, u.email AS cliente_email
         FROM negocios n
         INNER JOIN canchas c ON c.id = ?
         LEFT JOIN usuarios u ON u.id = ?
         WHERE n.id = ?`,
        [p.cancha_id, p.usuario_id, p.negocio_id]
      );

      await conn.commit();

      // 11. Envío asíncrono de correos transaccionales (sin bloquear respuesta HTTP)
      const meta = infoNegocio[0] || {};
      const emailDestino = meta.cliente_email;

      if (emailDestino) {
        Promise.resolve().then(async () => {
          try {
            await emailService.enviarConfirmacionReserva({
              email: emailDestino,
              clienteNombre: p.cliente_nombre,
              negocioNombre: meta.negocio_nombre || 'SportReserve',
              codigoReserva,
              canchaNombre: meta.cancha_nombre || 'Cancha Deportiva',
              fecha: p.fecha.toISOString ? p.fecha.toISOString().split('T')[0] : p.fecha,
              horaInicio: p.hora_inicio,
              horaFin: p.hora_fin,
              montoTotal: p.monto,
              montoPagado: p.monto,
              saldoPendiente: 0
            });

            await emailService.enviarComprobantePago({
              email: emailDestino,
              clienteNombre: p.cliente_nombre,
              negocioNombre: meta.negocio_nombre || 'SportReserve',
              codigoReserva,
              monto: p.monto,
              metodo: metodoPago,
              tipoPago: 'completo',
              referencia: refPago,
              numeroComprobante
            });
          } catch (mailErr) {
            console.error('⚠️ [Email Error en Pasarela]:', mailErr.message);
          }
        });
      }

      return {
        ok: true,
        reserva_id: reservaId,
        codigo_reserva: codigoReserva,
        comprobante: numeroComprobante,
        monto: p.monto,
        commerce_order: p.commerce_order
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Consulta el estado de una orden pendiente por token o commerce_order
   */
  async getEstado(tokenOrOrder) {
    const [rows] = await db.query(
      `SELECT rpp.*, r.codigo AS reserva_codigo, c.nombre AS cancha_nombre
       FROM reservas_pendientes_pago rpp
       LEFT JOIN reservas r ON rpp.reserva_id = r.id
       LEFT JOIN canchas c ON rpp.cancha_id = c.id
       WHERE rpp.token = ? OR rpp.commerce_order = ? LIMIT 1`,
      [tokenOrOrder, tokenOrOrder]
    );

    if (rows.length === 0) {
      const err = new Error('Orden no encontrada');
      err.statusCode = 404;
      throw err;
    }

    return rows[0];
  }
}

module.exports = new PasarelaPagoService();
