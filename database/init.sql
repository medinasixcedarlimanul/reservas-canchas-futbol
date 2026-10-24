-- =============================================================================
-- ESQUEMA GENERAL Y MULTI-NEGOCIO PARA PLATAFORMA DE RESERVAS DEPORTIVAS
-- Motor: MySQL 8.0+
-- Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. TABLA: negocios (Entidad raíz multi-tenant)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS negocios;
CREATE TABLE negocios (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(120)  NOT NULL,
  identificador   VARCHAR(80)   NOT NULL,
  telefono        VARCHAR(20)   NULL,
  email           VARCHAR(150)  NULL,
  direccion       VARCHAR(255)  NULL,
  activo          BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_negocios_identificador (identificador)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. TABLA: deportes (Catálogo unificado de disciplinas deportivas)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS deportes;
CREATE TABLE deportes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(50)   NOT NULL,
  descripcion     TEXT          NULL,
  activo          BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_deportes_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. TABLA: usuarios (Cuentas globales y personal asociado a negocios)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS usuarios;
CREATE TABLE usuarios (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id          INT           NULL,
  nombre              VARCHAR(100)  NOT NULL,
  email               VARCHAR(150)  NOT NULL,
  password_hash       VARCHAR(255)  NOT NULL,
  rol                 ENUM('superadmin', 'admin', 'recepcionista', 'cliente') NOT NULL DEFAULT 'cliente',
  telefono            VARCHAR(20)   NULL,
  dni                 VARCHAR(15)   NULL,
  activo              BOOLEAN       NOT NULL DEFAULT TRUE,
  login_intentos      INT           NOT NULL DEFAULT 0,
  bloqueado_hasta     DATETIME      NULL,
  reset_token         VARCHAR(255)  NULL,
  reset_token_expiry  DATETIME      NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuarios_email (email),
  FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_usuarios_negocio ON usuarios(negocio_id);

-- -----------------------------------------------------------------------------
-- 4. TABLA: canchas (Espacios deportivos administrados por cada negocio)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS canchas;
CREATE TABLE canchas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id      INT           NOT NULL,
  deporte_id      INT           NOT NULL,
  nombre          VARCHAR(100)  NOT NULL,
  descripcion     TEXT          NULL,
  capacidad       INT           NOT NULL DEFAULT 10,
  precio_hora     DECIMAL(10,2) NOT NULL,
  hora_apertura   TIME          NOT NULL DEFAULT '07:00:00',
  hora_cierre     TIME          NOT NULL DEFAULT '23:00:00',
  activo          BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE RESTRICT,
  FOREIGN KEY (deporte_id) REFERENCES deportes(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_canchas_negocio ON canchas(negocio_id);
CREATE INDEX idx_canchas_deporte ON canchas(deporte_id);
CREATE INDEX idx_canchas_activo ON canchas(activo);

-- -----------------------------------------------------------------------------
-- 5. TABLA: reservas (Registro central de transacciones de alquiler)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS reservas;
CREATE TABLE reservas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id      INT           NOT NULL,
  codigo          VARCHAR(20)   NOT NULL,
  cancha_id       INT           NOT NULL,
  usuario_id      INT           NOT NULL,
  fecha           DATE          NOT NULL,
  hora_inicio     TIME          NOT NULL,
  hora_fin        TIME          NOT NULL,
  estado          ENUM('pendiente', 'confirmada', 'cancelada', 'completada', 'pendiente_reembolso') NOT NULL DEFAULT 'pendiente',
  origen          ENUM('linea', 'recepcion') NOT NULL DEFAULT 'linea',
  notas           TEXT          NULL,
  cliente_nombre  VARCHAR(100)  NULL,
  cliente_dni     VARCHAR(15)   NULL,
  cancelado_por   INT           NULL,
  cancelado_at    DATETIME      NULL,
  checkin_at      DATETIME      NULL,
  checkin_por     INT           NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reservas_codigo (codigo),
  FOREIGN KEY (negocio_id)    REFERENCES negocios(id) ON DELETE RESTRICT,
  FOREIGN KEY (cancha_id)     REFERENCES canchas(id)  ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id)    REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (cancelado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  FOREIGN KEY (checkin_por)   REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_reservas_negocio_fecha ON reservas(negocio_id, fecha);
CREATE INDEX idx_reservas_slot ON reservas(cancha_id, fecha, hora_inicio);
CREATE INDEX idx_reservas_usuario ON reservas(usuario_id);
CREATE INDEX idx_reservas_estado ON reservas(estado);

-- -----------------------------------------------------------------------------
-- 6. TABLA: pagos (Cabecera financiera asociada a cada reserva)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS pagos;
CREATE TABLE pagos (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id              INT           NOT NULL,
  reserva_id              INT           NOT NULL,
  monto                   DECIMAL(10,2) NOT NULL,
  metodo                  ENUM('efectivo', 'transferencia', 'yape', 'plin', 'tarjeta', 'flow', 'mixto', 'cupon') NOT NULL,
  estado                  ENUM('pendiente', 'pagado', 'reembolsado') NOT NULL DEFAULT 'pendiente',
  tipo_pago               ENUM('completo', 'adelanto') NULL,
  referencia              VARCHAR(100)  NULL,
  reembolso_metodo        ENUM('efectivo', 'transferencia', 'cupon') NULL,
  reembolso_confirmado_at DATETIME      NULL,
  registrado_por          INT           NULL,
  notas                   TEXT          NULL,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pagos_reserva (reserva_id),
  FOREIGN KEY (negocio_id)     REFERENCES negocios(id) ON DELETE RESTRICT,
  FOREIGN KEY (reserva_id)     REFERENCES reservas(id) ON DELETE RESTRICT,
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_pagos_negocio_estado ON pagos(negocio_id, estado);
CREATE INDEX idx_pagos_metodo ON pagos(metodo);

-- -----------------------------------------------------------------------------
-- 7. TABLA: comprobantes (Boletas y facturas emitidas por pago)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS comprobantes;
CREATE TABLE comprobantes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id      INT           NOT NULL,
  pago_id         INT           NOT NULL,
  reserva_id      INT           NOT NULL,
  tipo            ENUM('boleta', 'factura') NOT NULL DEFAULT 'boleta',
  numero          VARCHAR(50)   NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comprobante_pago (pago_id),
  UNIQUE KEY uq_comprobante_negocio_numero (negocio_id, numero),
  FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE RESTRICT,
  FOREIGN KEY (pago_id)    REFERENCES pagos(id)    ON DELETE RESTRICT,
  FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_comprobantes_reserva ON comprobantes(reserva_id);

-- -----------------------------------------------------------------------------
-- 8. TABLA: notas_credito (Documentos de anulación o reembolso)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS notas_credito;
CREATE TABLE notas_credito (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id      INT           NOT NULL,
  comprobante_id  INT           NOT NULL,
  reserva_id      INT           NOT NULL,
  numero          VARCHAR(50)   NOT NULL,
  monto           DECIMAL(10,2) NOT NULL,
  cancelado_por   INT           NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_nota_credito_negocio_numero (negocio_id, numero),
  FOREIGN KEY (negocio_id)     REFERENCES negocios(id)     ON DELETE RESTRICT,
  FOREIGN KEY (comprobante_id) REFERENCES comprobantes(id) ON DELETE RESTRICT,
  FOREIGN KEY (reserva_id)     REFERENCES reservas(id)     ON DELETE RESTRICT,
  FOREIGN KEY (cancelado_por)  REFERENCES usuarios(id)     ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. TABLA: caja_turnos (Control de apertura, cuadre y cierre por recepción)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS caja_turnos;
CREATE TABLE caja_turnos (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id            INT           NOT NULL,
  estado                ENUM('abierta', 'cerrada') NOT NULL DEFAULT 'abierta',
  monto_inicial         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  abierta_por           INT           NOT NULL,
  nombre_recepcionista  VARCHAR(100)  NULL,
  abierta_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cerrada_por           INT           NULL,
  cerrada_at            DATETIME      NULL,
  efectivo_esperado     DECIMAL(10,2) NULL,
  efectivo_contado      DECIMAL(10,2) NULL,
  diferencia            DECIMAL(10,2) NULL,
  notas_cierre          TEXT          NULL,
  FOREIGN KEY (negocio_id)  REFERENCES negocios(id) ON DELETE RESTRICT,
  FOREIGN KEY (abierta_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (cerrada_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_caja_turnos_negocio_estado ON caja_turnos(negocio_id, estado);
CREATE INDEX idx_caja_turnos_abierta_at ON caja_turnos(abierta_at);

-- -----------------------------------------------------------------------------
-- 10. TABLA: pagos_movimientos (Desglose fraccionado y asignación a turnos de caja)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS pagos_movimientos;
CREATE TABLE pagos_movimientos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id      INT           NOT NULL,
  pago_id         INT           NOT NULL,
  caja_turno_id   INT           NULL,
  metodo          ENUM('efectivo', 'transferencia', 'yape', 'plin', 'tarjeta', 'flow', 'cupon') NOT NULL,
  monto           DECIMAL(10,2) NOT NULL,
  referencia      VARCHAR(100)  NULL,
  registrado_por  INT           NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (negocio_id)     REFERENCES negocios(id)    ON DELETE RESTRICT,
  FOREIGN KEY (pago_id)        REFERENCES pagos(id)       ON DELETE RESTRICT,
  FOREIGN KEY (caja_turno_id)  REFERENCES caja_turnos(id) ON DELETE SET NULL,
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_pagomov_caja ON pagos_movimientos(caja_turno_id);
CREATE INDEX idx_pagomov_pago ON pagos_movimientos(pago_id);
CREATE INDEX idx_pagomov_metodo ON pagos_movimientos(metodo);

-- -----------------------------------------------------------------------------
-- 11. TABLA: cupones (Créditos y compensaciones para clientes)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS cupones;
CREATE TABLE cupones (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id        INT           NOT NULL,
  codigo            VARCHAR(30)   NOT NULL,
  valor_inicial     DECIMAL(10,2) NOT NULL,
  saldo             DECIMAL(10,2) NOT NULL,
  motivo            VARCHAR(255)  NOT NULL,
  reserva_origen_id INT           NOT NULL,
  generado_por      INT           NOT NULL,
  estado            ENUM('activo', 'agotado', 'anulado') NOT NULL DEFAULT 'activo',
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cupon_negocio_codigo (negocio_id, codigo),
  FOREIGN KEY (negocio_id)        REFERENCES negocios(id) ON DELETE RESTRICT,
  FOREIGN KEY (reserva_origen_id) REFERENCES reservas(id) ON DELETE RESTRICT,
  FOREIGN KEY (generado_por)      REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_cupones_negocio_estado ON cupones(negocio_id, estado);

-- -----------------------------------------------------------------------------
-- 12. TABLA: cupones_movimientos (Historial de transacciones de saldo de cupones)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS cupones_movimientos;
CREATE TABLE cupones_movimientos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  cupon_id        INT           NOT NULL,
  reserva_id      INT           NULL,
  monto           DECIMAL(10,2) NOT NULL,
  tipo            ENUM('emision', 'canje', 'anulacion') NOT NULL,
  registrado_por  INT           NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cupon_id)       REFERENCES cupones(id)  ON DELETE RESTRICT,
  FOREIGN KEY (reserva_id)     REFERENCES reservas(id) ON DELETE SET NULL,
  FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_cuponmov_cupon ON cupones_movimientos(cupon_id);
CREATE INDEX idx_cuponmov_reserva ON cupones_movimientos(reserva_id);

-- -----------------------------------------------------------------------------
-- 13. TABLA: reservas_pendientes_pago (Transacciones de pasarela previa a reserva)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS reservas_pendientes_pago;
CREATE TABLE reservas_pendientes_pago (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id      INT           NOT NULL,
  commerce_order  VARCHAR(60)   NOT NULL,
  usuario_id      INT           NOT NULL,
  cancha_id       INT           NOT NULL,
  fecha           DATE          NOT NULL,
  hora_inicio     TIME          NOT NULL,
  hora_fin        TIME          NOT NULL,
  cliente_nombre  VARCHAR(100)  NOT NULL,
  cliente_dni     VARCHAR(15)   NOT NULL,
  notas           TEXT          NULL,
  monto           DECIMAL(10,2) NOT NULL,
  cupon_codigo    VARCHAR(30)   NULL,
  cupon_monto     DECIMAL(10,2) NULL,
  token           VARCHAR(100)  NULL,
  estado          ENUM('pendiente', 'confirmado', 'fallido', 'conflicto', 'expirado') NOT NULL DEFAULT 'pendiente',
  reserva_id      INT           NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pendientes_order (commerce_order),
  FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (cancha_id)  REFERENCES canchas(id)  ON DELETE RESTRICT,
  FOREIGN KEY (reserva_id) REFERENCES reservas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_pendientes_negocio_estado ON reservas_pendientes_pago(negocio_id, estado);
CREATE INDEX idx_pendientes_slot ON reservas_pendientes_pago(cancha_id, fecha, hora_inicio);

-- -----------------------------------------------------------------------------
-- 14. TABLA: caja_mensual (Apertura de balance base mensual por negocio)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS caja_mensual;
CREATE TABLE caja_mensual (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id      INT           NOT NULL,
  anio            INT           NOT NULL,
  mes             INT           NOT NULL,
  monto_inicial   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_caja_mes_negocio (negocio_id, anio, mes),
  FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 15. TABLA: informes_exportados (Trazabilidad de reportes contables y de gestión)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS informes_exportados;
CREATE TABLE informes_exportados (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id      INT           NOT NULL,
  nombre          VARCHAR(150)  NOT NULL,
  formato         ENUM('pdf', 'excel', 'csv') NOT NULL,
  desde           DATE          NOT NULL,
  hasta           DATE          NOT NULL,
  generado_por    INT           NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (negocio_id)   REFERENCES negocios(id) ON DELETE RESTRICT,
  FOREIGN KEY (generado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_informes_negocio ON informes_exportados(negocio_id, created_at);

-- -----------------------------------------------------------------------------
-- 16. TABLA: audit_log (Auditoría de eventos de seguridad y transaccionales)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS audit_log;
CREATE TABLE audit_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  negocio_id      INT           NULL,
  usuario_id      INT           NULL,
  email           VARCHAR(150)  NULL,
  accion          VARCHAR(50)   NOT NULL,
  ip              VARCHAR(45)   NULL,
  user_agent      VARCHAR(255)  NULL,
  resultado       ENUM('exitoso', 'fallido') NOT NULL,
  detalle         VARCHAR(255)  NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE SET NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_audit_negocio ON audit_log(negocio_id);
CREATE INDEX idx_audit_email ON audit_log(email);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- -----------------------------------------------------------------------------
-- 17. TABLA: tokens_revocados (Lista de revocación JWT para sesiones cerradas)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS tokens_revocados;
CREATE TABLE tokens_revocados (
  jti             VARCHAR(64) PRIMARY KEY,
  expiry          DATETIME    NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_tokens_expiry ON tokens_revocados(expiry);

SET FOREIGN_KEY_CHECKS = 1;
