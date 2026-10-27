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
│   └── reporteService.js       # Métricas operativas, KPIs e ingresos agrupados
├── controllers/
│   ├── authController.js
│   ├── negocioController.js
│   ├── deporteController.js
│   ├── canchaController.js
│   ├── reservaController.js
│   ├── pagoController.js
│   ├── cajaController.js
│   ├── cuponController.js
│   └── reporteController.js
├── routes/
│   ├── auth.js
│   ├── negocios.js
│   ├── deportes.js
│   ├── canchas.js
│   ├── reservas.js
│   ├── pagos.js
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

---

## 4. Ejecución en Desarrollo

1. Asegúrate de tener la base de datos MySQL corriendo:
   ```bash
   docker compose up -d
   ```
2. Instalar dependencias en el directorio `backend`:
   ```bash
   cd backend && npm install
   ```
3. Configurar variables de entorno locales:
   ```bash
   cp .env.example .env
   ```
4. Iniciar el servidor en modo desarrollo:
   ```bash
   npm run dev
   # o para modo estándar:
   npm start
   ```
5. El servidor estará escuchando en `http://localhost:3000`. Puedes verificar su estado en `http://localhost:3000/health`.
