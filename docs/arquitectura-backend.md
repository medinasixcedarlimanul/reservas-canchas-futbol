# Arquitectura del Backend — Plataforma Multi-Negocio de Reservas Deportivas

## 1. Visión General

El backend es un monolito modular construido sobre **Node.js + Express** en JavaScript, diseñado con arquitectura por capas desacopladas y aislamiento lógico para operar bajo el modelo **multi-negocio** (*multi-tenant*).

### Principios de Diseño
- **Arquitectura en Capas**:
  - `routes/`: Define las rutas HTTP y asocia middlewares de seguridad y contexto.
  - `controllers/`: Maneja la entrada/salida HTTP, parsing de parámetros y respuestas.
  - `services/`: Encapsula las reglas de negocio, transacciones e integridad lógica.
  - `db/`: Administra el pool de conexiones persistentes con `mysql2/promise`.
  - `middleware/`: Protecciones transversales (seguridad HTTP con Helmet, CORS, Rate Limiters, JWT, RBAC y contexto de inquilino).
- **Aislamiento Multi-Tenant**:
  - Personal operativo (`admin`, `recepcionista`): Queda restringido al `negocio_id` al que pertenece.
  - Clientes (`cliente`): Poseen cuenta global transversal para reservar en cualquier centro deportivo.
  - Superadministradores (`superadmin`): Tienen privilegios para gestionar todos los negocios y el catálogo global.

---

## 2. Estructura de Directorios

```text
backend/
├── db/
│   └── connection.js           # Pool de conexiones MySQL 8.0
├── middleware/
│   ├── verifyToken.js          # Autenticación JWT y validación contra tokens_revocados
│   ├── checkRole.js            # Autorización por roles (superadmin, admin, recepcionista, cliente)
│   ├── tenantContext.js        # Validación y asignación del contexto de negocio (negocio_id)
│   ├── rateLimiter.js          # Límites de peticiones (general y de autenticación)
│   └── errorHandler.js         # Manejador global de excepciones y códigos de error MySQL
├── services/
│   ├── authService.js          # Registro, login, bloqueo de cuentas, auditoría y logout
│   ├── negocioService.js       # CRUD y administración de complejos deportivos
│   ├── deporteService.js       # Catálogo de disciplinas deportivas
│   ├── canchaService.js        # Gestión de canchas y cálculo de slots de disponibilidad
│   ├── reservaService.js       # Creación de reservas, prevención de colisiones y check-in
│   ├── pagoService.js          # Transacciones de pagos, movimientos y reembolsos/notas de crédito
│   ├── cajaService.js          # Control de turnos de recepción (apertura, arqueo y cierre)
│   ├── cuponService.js         # Emisión, validación y canje de cupones de compensación
│   ├── reporteService.js       # Métricas operativas, KPIs e ingresos agrupados
│   ├── pasarelaPagoService.js  # Motor multi-pasarela (Flow, Stripe y simulador Sandbox)
│   └── emailService.js         # Emisión de correos transaccionales (Resend, Brevo y Mock)
├── controllers/
│   ├── authController.js
│   ├── negocioController.js
│   ├── deporteController.js
│   ├── canchaController.js
│   ├── reservaController.js
│   ├── pagoController.js
│   ├── cajaController.js
│   ├── cuponController.js
│   ├── reporteController.js
│   └── pasarelaController.js
├── routes/
│   ├── auth.js
│   ├── negocios.js
│   ├── deportes.js
│   ├── canchas.js
│   ├── reservas.js
│   ├── pagos.js
│   ├── pasarela.js
│   ├── caja.js
│   ├── cupones.js
│   └── reportes.js
├── .env.example                # Plantilla de variables de entorno
├── app.js                      # Configuración principal del servidor Express
└── package.json                # Dependencias del servicio
```

---

## 3. Catálogo de Endpoints API

### 3.1 Autenticación y Cuentas (`/api/auth`)
| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/registro` | Público | Registro de cliente con cuenta global. |
| `POST` | `/api/auth/login` | Público | Autenticación con JWT (control de 5 intentos y bloqueo temporal). |
| `POST` | `/api/auth/logout` | Autenticado | Invalida el token JWT en la lista negra (`tokens_revocados`). |
| `GET` | `/api/auth/me` | Autenticado | Retorna el perfil del usuario autenticado. |

### 3.2 Negocios (`/api/negocios`)
| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/negocios` | Público | Lista los centros deportivos activos. |
| `GET` | `/api/negocios/:id` | Público | Consulta el detalle de un negocio específico. |
| `POST` | `/api/negocios` | `superadmin` | Registra un nuevo negocio en la plataforma. |
| `PUT` | `/api/negocios/:id` | `superadmin`, `admin` | Actualiza la información del centro deportivo. |

### 3.3 Deportes (`/api/deportes`)
| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/deportes` | Público | Catálogo general de disciplinas deportivas. |
| `GET` | `/api/deportes/:id` | Público | Detalle de una disciplina. |
| `POST` | `/api/deportes` | `superadmin`, `admin` | Crea una nueva disciplina deportiva. |

### 3.4 Canchas y Disponibilidad (`/api/canchas`)
| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/canchas` | Público | Catálogo de canchas (filtros por `negocio_id` y `deporte_id`). |
| `GET` | `/api/canchas/:id` | Público | Detalle técnico y tarifas de la cancha. |
| `GET` | `/api/canchas/:id/disponibilidad` | Público | Genera y valida slots de 1h según horario y reservas activas. |
| `POST` | `/api/canchas` | `superadmin`, `admin` | Da de alta una cancha en el negocio. |
| `PUT` | `/api/canchas/:id` | `superadmin`, `admin` | Modifica tarifas, estado u horarios de la cancha. |

### 3.5 Reservas (`/api/reservas`)
| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/reservas` | Autenticado | Lista reservas (clientes ven solo las suyas, personal ve las de su negocio). |
| `GET` | `/api/reservas/:id` | Autenticado | Detalle completo de una reserva. |
| `GET` | `/api/reservas/codigo/:codigo` | Autenticado | Búsqueda por localizador alfanumérico. |
| `POST` | `/api/reservas` | Autenticado | Crea reserva validando slots libres (soporta ventanilla con datos de cliente). |
| `PUT` | `/api/reservas/:id/cancelar` | Autenticado | Cancela la reserva y registra trazabilidad. |
| `PUT` | `/api/reservas/:id/checkin` | Personal | Confirma asistencia presencial en recepción. |

### 3.6 Pagos y Facturación (`/api/pagos`)
| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/pagos` | Personal | Historial de pagos por negocio, estado y método. |
| `GET` | `/api/pagos/:id` | Personal | Detalle con desglose de movimientos y comprobantes. |
| `POST` | `/api/pagos` | Personal | Registra cobro (soporta desglose, turno de caja y emisión de boleta/factura). |
| `POST` | `/api/pagos/:id/reembolso` | Personal | Procesa reembolso y emite nota de crédito si corresponde. |

### 3.7 Caja y Recepción (`/api/caja`)
| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/caja/turno-activo` | Personal | Consulta el turno de caja abierto del usuario. |
| `POST` | `/api/caja/abrir` | Personal | Apertura de turno con monto inicial. |
| `POST` | `/api/caja/cerrar/:id` | Personal | Cierre de turno, arqueo de efectivo y cálculo de descuadre. |
| `GET` | `/api/caja/historial` | Personal | Historial cronológico de turnos de caja cerrados. |

### 3.8 Cupones de Compensación (`/api/cupones`)
| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/cupones` | Personal | Listado de cupones por negocio y estado. |
| `GET` | `/api/cupones/validar` | Autenticado | Valida código de cupón y saldo remanente. |
| `POST` | `/api/cupones` | Personal | Emite cupón compensatorio vinculado a una reserva origen. |
| `POST` | `/api/cupones/:id/canjear` | Personal | Consume saldo del cupón al imputarlo a una nueva reserva. |

### 3.9 Reportes y KPIs (`/api/reportes`)
| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `GET` | `/api/reportes/dashboard` | `superadmin`, `admin` | Métricas de ocupación, ingresos por método y estados de reserva. |

### 3.10 Pasarela de Pagos Online (`/api/pagos/online`)
| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/pagos/online/iniciar` | Cliente | Inicia transacción online con bloqueo temporal (15 min) y genera checkout en pasarela (Flow, Stripe o Mock). |
| `POST` | `/api/pagos/online/webhook/flow` | Público | Webhook de confirmación asíncrona para Flow API. |
| `POST` | `/api/pagos/online/webhook/stripe` | Público | Webhook de confirmación asíncrona para Stripe Checkout (`checkout.session.completed`). |
| `GET` | `/api/pagos/online/retorno` | Público | Redirección del navegador post-pago hacia `/mis-reservas.html?pago_exitoso=true`. |
| `GET` | `/api/pagos/online/estado/:token` | Cliente | Consulta el estado de la transacción y orden pendiente. |
| `GET` | `/api/pagos/online/sandbox-checkout` | Público | Vista interactiva de simulación de pago en local cuando no hay API keys configuradas. |
| `POST` | `/api/pagos/online/sandbox-confirmar`| Público | Emite confirmación de cobro simulado para pruebas locales. |

### 3.11 Servicio de Correo Transaccional (`emailService`)
Módulo centralizado para la emisión de correos HTML responsivos. Diseñado de forma modular para operar con **cero dependencias** (utiliza `fetch` nativo de Node.js):
- **Proveedores soportados**: `resend`, `brevo`, o `mock` (simulación en consola si no se han cargado credenciales).
- **Tipos de correo emitidos**:
  1. `enviarConfirmacionReserva`: Emitido automáticamente al confirmar una reserva (online o presencial).
  2. `enviarComprobantePago`: Notificación de boleta/factura con desglose del monto abonado y referencia.
  3. `enviarCancelacionReserva`: Aviso al cliente tras cancelar un horario.
- **Activación en producción**: Solo requiere colocar `RESEND_API_KEY` o `BREVO_API_KEY` en el archivo `.env`.

---

## 4. Ejecución del Backend

### 4.1 Opción A: Despliegue con Docker (Recomendado)
Levanta toda la plataforma (Base de datos + API Backend) de forma coordinada con un solo comando:
```bash
docker compose up --build -d
```
- El contenedor `reservas-canchas-db` arrancará primero y verificará su salud.
- El contenedor `reservas-canchas-backend` esperará automáticamente a que la base de datos esté lista antes de inicializar Express.
- La API estará escuchando en `http://localhost:3000`.

### 4.2 Opción B: Ejecución Local con Node.js
Para desarrollo interactivo en la máquina host:
1. Iniciar el servicio de base de datos en Docker:
   ```bash
   docker compose up -d db
   ```
2. Instalar dependencias en `backend/`:
   ```bash
   cd backend && npm install
   ```
3. Configurar variables de entorno locales:
   ```bash
   cp .env.example .env
   ```
4. Iniciar el servidor:
   ```bash
   npm run dev
   # o para modo producción:
   npm start
   ```
5. Endpoint de comprobación de salud: `http://localhost:3000/health`.

