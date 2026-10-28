# Plataforma de Reservas Deportivas (Multi-Negocio)

Plataforma integral, modular y escalable para la gestión y reserva de canchas y centros deportivos con arquitectura **multi-negocio** (*multi-tenant*). El sistema está diseñado de forma genérica para permitir que múltiples complejos deportivos operen de manera independiente, permitiendo a los clientes finales explorar complejos, verificar disponibilidad en tiempo real y reservar espacios deportivos desde una cuenta unificada.

---

## 📌 Estado del Proyecto

- **Fase Actual**: Base de Datos, Backend API, Frontend Web e Integraciones Externas (Todos integrados y contenedorizados).
- **Motor de BD**: MySQL 8.0+ (InnoDB, UTF-8 `utf8mb4`).
- **Servidor Backend**: Node.js 20 (Express) contenedorizado en Alpine Linux.
- **Frontend**: Interfaz web moderna (HTML5 semántico, Vanilla CSS Design System con Glassmorphism y Vanilla JS ES6+) servida por el backend.
- **Pasarelas de Pago**: Soporte para **Flow**, **Stripe** y **Modo Sandbox / Simulador Local** integrado.
- **Correos Transaccionales**: Soporte para **Resend**, **Brevo** y **Modo Mock** con plantillas HTML responsivas.
- **Despliegue Local**: Docker Compose orquestando Base de Datos + API Backend + Frontend en `http://localhost:3000`.

---

## 📚 Índice de Documentación Técnica

El proyecto cuenta con documentación técnica exhaustiva para cada área del sistema:

| Documento | Enlace | Descripción |
|---|---|---|
| **Modelo de Datos** | [docs/modelo-datos.md](docs/modelo-datos.md) | Diagrama ER en Mermaid, diccionario de 17 tablas, índices y aislamiento multi-tenant. |
| **Arquitectura del Backend** | [docs/arquitectura-backend.md](docs/arquitectura-backend.md) | Catálogo completo de endpoints REST, controladores, servicios, middlewares y JWT. |
| **Arquitectura del Frontend** | [docs/arquitectura-frontend.md](docs/arquitectura-frontend.md) | Sistema de diseño, tokens CSS, componentes glassmorphism, guards cliente y vistas. |
| **Guía de Integraciones** | [docs/guia-integraciones.md](docs/guia-integraciones.md) | Configuración paso a paso de Flow, Stripe, Resend, Brevo y Sandbox Checkout. |
| **Manual de Operaciones** | [docs/manual-operaciones.md](docs/manual-operaciones.md) | Matriz de roles (RBAC), flujo diario de caja, check-in, políticas de cancelación y cupones. |
| **Despliegue & DevOps** | [docs/despliegue-y-mantenimiento.md](docs/despliegue-y-mantenimiento.md) | Puesta en producción, backups automatizados con `mysqldump`, monitoreo y troubleshooting. |

---

## 🌐 URLs de Acceso a la Plataforma Web

Con los contenedores activos, puedes acceder directamente desde tu navegador a:

| Página | URL Local | Rol / Propósito |
|---|---|---|
| **Inicio / Landing Page** | [`http://localhost:3000/`](http://localhost:3000/) | Público / Complejos y canchas destacadas |
| **Catálogo de Canchas** | [`http://localhost:3000/canchas.html`](http://localhost:3000/canchas.html) | Filtro por sede deportiva y disciplina |
| **Reserva de Horarios** | [`http://localhost:3000/reservar.html`](http://localhost:3000/reservar.html) | Selector de turnos, cupones y checkout online |
| **Mis Reservas** | [`http://localhost:3000/mis-reservas.html`](http://localhost:3000/mis-reservas.html) | Historial de reservas del cliente y cancelación |
| **Inicio de Sesión** | [`http://localhost:3000/login.html`](http://localhost:3000/login.html) | Acceso al sistema con redirección por rol |
| **Registro de Cliente** | [`http://localhost:3000/registro.html`](http://localhost:3000/registro.html) | Creación de cuenta global de cliente |
| **Recepción & Caja** | [`http://localhost:3000/recepcion.html`](http://localhost:3000/recepcion.html) | Turnos de caja, check-in y ventas en ventanilla |
| **Administración & KPIs** | [`http://localhost:3000/admin.html`](http://localhost:3000/admin.html) | Métricas de ingresos, gestión de canchas y cupones |
| **Simulador de Pasarela** | [`http://localhost:3000/api/pagos/online/sandbox-checkout`](http://localhost:3000/api/pagos/online/sandbox-checkout) | Emulador de pagos online para pruebas locales |

---

## 🗂 Estructura del Repositorio

```text
reservas-canchas-futbol/
├── backend/                # API REST en Node.js + Express
│   ├── db/                 # Conexión al pool persistente de MySQL
│   ├── middleware/         # Autenticación JWT, roles, rate limit y contexto multi-tenant
│   ├── services/           # Lógica de negocio (auth, canchas, reservas, pasarela, email, etc.)
│   ├── controllers/        # Controladores HTTP y manejo de webhooks
│   ├── routes/             # Enrutamiento modular por dominio
│   ├── Dockerfile          # Imagen Docker ligera de producción en Alpine
│   └── package.json        # Dependencias de backend
├── frontend/               # Interfaz web responsiva (Vanilla HTML5 / CSS3 / JS ES6+)
│   ├── css/main.css        # Sistema de diseño, glassmorphism, variables y responsive
│   ├── js/api.js           # Fetch wrapper con headers automáticos JWT y multi-tenant
│   ├── js/auth.js          # Control de sesión en localStorage y route guards
│   ├── js/navbar.js        # Barra de navegación adaptativa por rol
│   ├── index.html          # Landing page
│   ├── canchas.html        # Catálogo filtrable
│   ├── reservar.html       # Selector de franjas horarias y checkout
│   ├── mis-reservas.html   # Panel de reservas del cliente
│   ├── login.html          # Formulario de autenticación
│   ├── registro.html       # Auto-registro de clientes
│   ├── recepcion.html      # Check-in, control de turnos de caja y ventanilla
│   └── admin.html          # Panel administrativo, métricas KPI y cupones
├── database/
│   └── init.sql            # Script DDL consolidado (17 tablas con índices y constraints)
├── docs/
│   ├── modelo-datos.md     # Documentación técnica de BD y diagrama ER
│   ├── arquitectura-backend.md   # Especificación técnica de la API REST
│   ├── arquitectura-frontend.md  # Guía del sistema de diseño y vistas web
│   ├── guia-integraciones.md     # Guía de pasarelas (Flow, Stripe) y correos (Resend, Brevo)
│   ├── manual-operaciones.md     # Matriz RBAC, turnos de caja, check-in y cancelaciones
│   └── despliegue-y-mantenimiento.md # Despliegue en producción, backups y DevOps
├── .env.example            # Plantilla completa de variables de entorno
├── .gitignore              # Reglas de exclusión para git
├── docker-compose.yml      # Orquestación de MySQL 8.0 y API Backend + Frontend
└── README.md               # Documentación general del proyecto
```

---

## 🚀 Puesta en Marcha Rápida (Docker)

### 1. Requisitos Previos
- [Docker](https://www.docker.com/) y Docker Compose (o [Colima](https://github.com/abiosoft/colima) en macOS).

### 2. Configurar Variables de Entorno
Crea una copia del archivo de ejemplo en la raíz:
```bash
cp .env.example .env
```

### 3. Iniciar la Plataforma (BD + Backend + Frontend)
Levanta todos los servicios en segundo plano con un solo comando:
```bash
docker compose up --build -d
```
> El contenedor de base de datos (`reservas-canchas-db`) arrancará primero, ejecutará `database/init.sql` y el contenedor de la API (`reservas-canchas-backend`) esperará automáticamente a que la base de datos esté lista y saludable antes de iniciar el servidor.

### 4. Verificar el Estado
Comprueba que ambos contenedores se encuentren activos:
```bash
docker compose ps
```
Verifica la respuesta del endpoint de salud del backend:
```bash
curl http://localhost:3000/health
```

### 5. Comandos Útiles de Operación
- Ver logs en vivo del backend (incluyendo correos simulados):
  ```bash
  docker compose logs -f backend
  ```
- Ingresar a la consola interactiva de MySQL:
  ```bash
  docker compose exec db mysql -u reservas_app -psecret_app_password reservas_db
  ```
- Generar un backup completo de la base de datos:
  ```bash
  docker compose exec db mysqldump -u reservas_app -psecret_app_password reservas_db > backup.sql
  ```
- Detener todos los contenedores:
  ```bash
  docker compose down
  ```

---

## 🏛 Arquitectura de Datos

El modelo relacional está compuesto por 17 entidades organizadas en torno al aislamiento por inquilino (`negocio_id`):

- **Núcleo Multi-Negocio**: `negocios` (raíz multi-tenant) y `deportes` (catálogo normalizado de disciplinas).
- **Acceso e Identidad**: `usuarios` (soporta clientes globales y personal administrativo por sede).
- **Catálogo y Disponibilidad**: `canchas` vinculadas a cada negocio y deporte.
- **Transacciones de Reserva**: `reservas` y `reservas_pendientes_pago` (control de pasarela online previa a confirmación con bloqueo temporal de 15 minutos).
- **Gestión Financiera**: `pagos`, `pagos_movimientos`, `comprobantes` (boleta/factura) y `notas_credito`.
- **Operación de Caja y Compensaciones**: `caja_turnos`, `caja_mensual`, `cupones` y `cupones_movimientos`.
- **Seguridad y Trazabilidad**: `audit_log` y `tokens_revocados` (lista negra de JWT tras logout).

> Para consultar el **diagrama relacional en Mermaid**, tipos de datos y detalle de restricciones, revisa [docs/modelo-datos.md](docs/modelo-datos.md).

---

## 🌿 Convenciones de Desarrollo

- **Control de Versiones**: Flujo basado en ramas de características (`feat/*`, `docs/*`, `fix/*`).
- **Commits**: Formato estricto [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).
