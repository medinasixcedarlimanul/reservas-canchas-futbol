'use strict';

/**
 * Servicio Centralizado de Correo Transaccional Multi-Tenant
 * Soporta proveedores directos:
 *  - Resend (API REST oficial)
 *  - Brevo / Sendinblue (API v3 SMTP)
 *  - Mock (Modo simulación por defecto cuando no hay API keys configuradas)
 */
class EmailService {
  constructor() {
    this.provider = (process.env.EMAIL_PROVIDER || 'mock').toLowerCase();
    this.fromEmail = process.env.EMAIL_FROM || 'reservas@sportreserve.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'SportReserve Platform';
    this.resendKey = process.env.RESEND_API_KEY || '';
    this.brevoKey = process.env.BREVO_API_KEY || '';
  }

  /**
   * Envía un correo HTML utilizando el proveedor configurado o simulación si no hay credenciales.
   */
  async enviarEmail({ to, subject, htmlContent, textContent = '' }) {
    if (!to) {
      console.warn('⚠️ [EmailService] Intento de envío sin destinatario especificado');
      return { success: false, error: 'Destinatario requerido' };
    }

    // 1. Proveedor Resend
    if ((this.provider === 'resend' || this.resendKey) && this.resendKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.resendKey}`
          },
          body: JSON.stringify({
            from: `${this.fromName} <${this.fromEmail}>`,
            to: Array.isArray(to) ? to : [to],
            subject,
            html: htmlContent,
            text: textContent
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || `Resend HTTP error ${response.status}`);
        }

        console.log(`✉️ [Resend] Correo enviado exitosamente a ${to}. ID: ${data.id}`);
        return { success: true, provider: 'resend', id: data.id };
      } catch (err) {
        console.error('❌ [Resend Error]:', err.message);
        return { success: false, error: err.message };
      }
    }

    // 2. Proveedor Brevo (Sendinblue)
    if ((this.provider === 'brevo' || this.brevoKey) && this.brevoKey) {
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.brevoKey
          },
          body: JSON.stringify({
            sender: { name: this.fromName, email: this.fromEmail },
            to: Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }],
            subject,
            htmlContent
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || `Brevo HTTP error ${response.status}`);
        }

        console.log(`✉️ [Brevo] Correo enviado exitosamente a ${to}. MessageId: ${data.messageId}`);
        return { success: true, provider: 'brevo', id: data.messageId };
      } catch (err) {
        console.error('❌ [Brevo Error]:', err.message);
        return { success: false, error: err.message };
      }
    }

    // 3. Modo Simulación (Mock) - Sin credenciales configuradas
    const mockId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    console.log(`📧 [EMAIL MOCK SIMULATION] =======================================`);
    console.log(` Destinatario: ${to}`);
    console.log(` Remitente:    ${this.fromName} <${this.fromEmail}>`);
    console.log(` Asunto:       ${subject}`);
    console.log(` Proveedor:    Simulado (Agrega RESEND_API_KEY o BREVO_API_KEY en .env para envíos reales)`);
    console.log(` ID Generado:  ${mockId}`);
    console.log(`===================================================================`);

    return { success: true, provider: 'mock', id: mockId };
  }

  /**
   * Notificación de confirmación de reserva
   */
  async enviarConfirmacionReserva({
    email,
    clienteNombre,
    negocioNombre = 'SportReserve',
    codigoReserva,
    canchaNombre,
    fecha,
    horaInicio,
    horaFin,
    montoTotal,
    montoPagado = 0,
    saldoPendiente = 0
  }) {
    const subject = `⚽ Reserva Confirmada [${codigoReserva}] — ${negocioNombre}`;
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b0f19; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">${negocioNombre}</h1>
          <p style="margin: 8px 0 0; color: #d1fae5; font-size: 15px;">¡Tu reserva ha sido confirmada con éxito!</p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="margin-top: 0; font-size: 16px;">Hola <strong>${clienteNombre}</strong>,</p>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">Hemos registrado tu reserva deportiva en nuestra plataforma. A continuación encuentras el resumen de tu horario:</p>
          
          <div style="background-color: #121826; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Código de Reserva:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #10b981; font-family: monospace; font-size: 15px;">${codigoReserva}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Cancha Deportiva:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">${canchaNombre}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Fecha:</td>
                <td style="padding: 6px 0; text-align: right;">${fecha}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Horario:</td>
                <td style="padding: 6px 0; text-align: right;">${horaInicio} a ${horaFin}</td>
              </tr>
              <tr style="border-top: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 10px 0 6px; color: #94a3b8;">Monto Total:</td>
                <td style="padding: 10px 0 6px; text-align: right; font-weight: bold; color: #f8fafc;">S/ ${parseFloat(montoTotal).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Monto Pagado:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #10b981;">S/ ${parseFloat(montoPagado).toFixed(2)}</td>
              </tr>
              ${saldoPendiente > 0 ? `
              <tr>
                <td style="padding: 6px 0; color: #f59e0b;">Saldo Pendiente en Sede:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #f59e0b;">S/ ${parseFloat(saldoPendiente).toFixed(2)}</td>
              </tr>` : ''}
            </table>
          </div>

          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            * Por favor preséntate 10 minutos antes en la recepción del centro deportivo con tu código de reserva para el check-in de asistencia.
          </p>
        </div>
        <div style="background-color: #080c14; padding: 16px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b;">
          ${negocioNombre} • Plataforma Multi-Negocio SportReserve
        </div>
      </div>
    `;

    return this.enviarEmail({ to: email, subject, htmlContent });
  }

  /**
   * Notificación de comprobante de pago emitido
   */
  async enviarComprobantePago({
    email,
    clienteNombre,
    negocioNombre = 'SportReserve',
    codigoReserva,
    monto,
    metodo,
    tipoPago,
    referencia,
    numeroComprobante
  }) {
    const subject = `🧾 Comprobante de Pago [${numeroComprobante || codigoReserva}] — ${negocioNombre}`;
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b0f19; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
        <div style="background: linear-gradient(135deg, #06b6d4 0%, #0284c7 100%); padding: 30px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">${negocioNombre}</h1>
          <p style="margin: 8px 0 0; color: #e0f2fe; font-size: 15px;">Constancia de Pago Registrado</p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="margin-top: 0; font-size: 16px;">Estimado/a <strong>${clienteNombre}</strong>,</p>
          <p style="color: #94a3b8; font-size: 14px;">Hemos procesado correctamente tu pago asociado a la reserva <strong>${codigoReserva}</strong>:</p>
          
          <div style="background-color: #121826; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              ${numeroComprobante ? `
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">N° Comprobante:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #06b6d4;">${numeroComprobante}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Concepto:</td>
                <td style="padding: 6px 0; text-align: right;">${tipoPago === 'adelanto' ? 'Adelanto de Reserva (50%)' : 'Pago Completo'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Método de Pago:</td>
                <td style="padding: 6px 0; text-align: right; text-transform: capitalize;">${metodo}</td>
              </tr>
              ${referencia ? `
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Referencia / Operación:</td>
                <td style="padding: 6px 0; text-align: right; font-family: monospace;">${referencia}</td>
              </tr>` : ''}
              <tr style="border-top: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 10px 0 6px; color: #94a3b8; font-weight: bold;">Monto Abonado:</td>
                <td style="padding: 10px 0 6px; text-align: right; font-weight: 800; color: #10b981; font-size: 18px;">S/ ${parseFloat(monto).toFixed(2)}</td>
              </tr>
            </table>
          </div>
        </div>
        <div style="background-color: #080c14; padding: 16px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b;">
          Gracias por confiar en ${negocioNombre}.
        </div>
      </div>
    `;

    return this.enviarEmail({ to: email, subject, htmlContent });
  }

  /**
   * Notificación de cancelación de reserva
   */
  async enviarCancelacionReserva({
    email,
    clienteNombre,
    negocioNombre = 'SportReserve',
    codigoReserva,
    canchaNombre,
    fecha,
    horaInicio,
    horaFin,
    montoReembolso = 0
  }) {
    const subject = `🚫 Cancelación de Reserva [${codigoReserva}] — ${negocioNombre}`;
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b0f19; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">${negocioNombre}</h1>
          <p style="margin: 8px 0 0; color: #fee2e2; font-size: 15px;">Aviso de Cancelación de Reserva</p>
        </div>
        <div style="padding: 28px 24px;">
          <p style="margin-top: 0; font-size: 16px;">Hola <strong>${clienteNombre}</strong>,</p>
          <p style="color: #94a3b8; font-size: 14px;">Te confirmamos que la siguiente reserva ha sido cancelada en el sistema:</p>
          
          <div style="background-color: #121826; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Código:</td>
                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #ef4444; font-family: monospace;">${codigoReserva}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Cancha:</td>
                <td style="padding: 6px 0; text-align: right;">${canchaNombre}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8;">Fecha y Horario:</td>
                <td style="padding: 6px 0; text-align: right;">${fecha} (${horaInicio} - ${horaFin})</td>
              </tr>
              ${montoReembolso > 0 ? `
              <tr style="border-top: 1px solid rgba(255,255,255,0.1);">
                <td style="padding: 10px 0 6px; color: #94a3b8;">Reembolso / Cupón emitido:</td>
                <td style="padding: 10px 0 6px; text-align: right; font-weight: bold; color: #10b981;">S/ ${parseFloat(montoReembolso).toFixed(2)}</td>
              </tr>` : ''}
            </table>
          </div>
        </div>
        <div style="background-color: #080c14; padding: 16px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #64748b;">
          ${negocioNombre} • Plataforma Multi-Negocio SportReserve
        </div>
      </div>
    `;

    return this.enviarEmail({ to: email, subject, htmlContent });
  }
}

module.exports = new EmailService();
