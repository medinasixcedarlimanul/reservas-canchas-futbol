'use strict';
const pasarelaPagoService = require('../services/pasarelaPagoService');

class PasarelaController {
  /**
   * Inicia la pasarela de pago para una reserva en línea
   */
  async iniciar(req, res, next) {
    try {
      const {
        cancha_id,
        fecha,
        hora_inicio,
        hora_fin,
        cliente_nombre,
        cliente_dni,
        notas,
        monto,
        tipo_pago,
        cupon_codigo,
        cupon_monto
      } = req.body;

      if (!cancha_id || !fecha || !hora_inicio || !hora_fin || !monto) {
        return res.status(400).json({
          error: 'Campos obligatorios: cancha_id, fecha, hora_inicio, hora_fin, monto'
        });
      }

      const negocioId = req.user.negocio_id || req.body.negocio_id;
      if (!negocioId) {
        return res.status(400).json({ error: 'ID de sede o negocio es requerido' });
      }

      const hostUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

      const resultado = await pasarelaPagoService.iniciarPago({
        appUrl: hostUrl,
        negocioId: parseInt(negocioId, 10),
        usuarioId: req.user.id,
        canchaId: parseInt(cancha_id, 10),
        fecha,
        horaInicio: hora_inicio,
        horaFin: hora_fin,
        clienteNombre: cliente_nombre || req.user.nombre,
        clienteDni: cliente_dni || req.user.dni || '00000000',
        clienteEmail: req.user.email,
        notas,
        monto: parseFloat(monto),
        tipoPago: tipo_pago || 'completo',
        cuponCodigo: cupon_codigo,
        cuponMonto: cupon_monto ? parseFloat(cupon_monto) : 0
      });

      res.status(201).json(resultado);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Webhook oficial para Flow API
   */
  async webhookFlow(req, res, next) {
    try {
      const token = req.body.token || req.query.token;
      if (!token) {
        return res.status(400).json({ error: 'Token de Flow no proporcionado' });
      }

      const confirmacion = await pasarelaPagoService.confirmarPago({
        token,
        provider: 'flow'
      });

      res.json({ ok: true, confirmacion });
    } catch (err) {
      console.error('❌ [Error Webhook Flow]:', err.message);
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Webhook oficial para Stripe API
   */
  async webhookStripe(req, res, next) {
    try {
      const event = req.body;
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        await pasarelaPagoService.confirmarPago({
          token: session.id,
          provider: 'stripe',
          referenciaExterna: session.payment_intent || session.id
        });
      }
      res.json({ received: true });
    } catch (err) {
      console.error('❌ [Error Webhook Stripe]:', err.message);
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Endpoint de retorno tras completar el pago en la pasarela
   */
  async retornoWeb(req, res, next) {
    try {
      const { order, token, session_id } = req.query;
      const ref = token || session_id || order;

      // Si viene con token y está en modo sandbox o retorno directo, intentamos confirmar
      if (ref) {
        try {
          await pasarelaPagoService.confirmarPago({ token: ref, provider: 'mock' });
        } catch (e) {
          // Si ya estaba confirmado no es error
        }
      }

      res.redirect('/mis-reservas.html?pago_exitoso=true');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Consulta el estado de una orden pendiente
   */
  async consultarEstado(req, res, next) {
    try {
      const data = await pasarelaPagoService.getEstado(req.params.token);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Página interactiva HTML de Checkout en modo Sandbox
   * Permite probar el flujo en local con un solo clic sin necesidad de API keys
   */
  async renderSandboxCheckout(req, res, next) {
    try {
      const token = req.query.token;
      if (!token) {
        return res.status(400).send('Token no especificado');
      }

      const orden = await pasarelaPagoService.getEstado(token);

      res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Simulador de Pasarela — SportReserve Sandbox</title>
          <link rel="stylesheet" href="/css/main.css">
          <style>
            body { display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
            .box { max-width: 500px; width: 100%; border-top: 4px solid var(--accent); }
          </style>
        </head>
        <body>
          <div class="card box">
            <div style="text-align: center; margin-bottom: 1.5rem;">
              <span class="badge badge-accent">Modo Simulación (Sandbox)</span>
              <h1 style="font-size: 1.6rem; margin-top: 0.75rem;">Simulador de Pasarela Online</h1>
              <p style="color: var(--text-muted); font-size: 0.9rem;">
                Esta pantalla emula pasarelas como Flow o Stripe en desarrollo.
              </p>
            </div>

            <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; font-size: 0.9rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Orden:</span>
                <strong>${orden.commerce_order}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Cancha:</span>
                <span>${orden.cancha_nombre || 'Cancha #' + orden.cancha_id}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Fecha y Horario:</span>
                <span>${orden.fecha.toISOString ? orden.fecha.toISOString().split('T')[0] : orden.fecha} (${orden.hora_inicio} - ${orden.hora_fin})</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color); font-size: 1.1rem;">
                <span>Total a Cobrar:</span>
                <strong style="color: var(--primary);">S/ ${parseFloat(orden.monto).toFixed(2)}</strong>
              </div>
            </div>

            <form action="/api/pagos/online/sandbox-confirmar" method="POST">
              <input type="hidden" name="token" value="${token}">
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">
                  💳 Simular Pago Aprobado
                </button>
                <a href="/canchas.html" class="btn btn-secondary" style="width: 100%; text-align: center;">
                  Cancelar y Volver
                </a>
              </div>
            </form>

            <p style="font-size: 0.75rem; color: var(--text-dim); text-align: center; margin-top: 1.25rem;">
              Al ingresar credenciales reales en tu archivo <code>.env</code> (Flow o Stripe), serás redirigido a la pasarela real automáticamente.
            </p>
          </div>
        </body>
        </html>
      `);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Confirma el pago en la simulación de sandbox
   */
  async confirmarSandbox(req, res, next) {
    try {
      const { token } = req.body;
      const resultado = await pasarelaPagoService.confirmarPago({
        token,
        provider: 'mock',
        referenciaExterna: `MOCK-OP-${Date.now()}`
      });

      res.redirect(`/mis-reservas.html?pago_exitoso=true&codigo=${resultado.codigo_reserva}`);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PasarelaController();

