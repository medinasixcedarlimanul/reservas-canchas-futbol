# Arquitectura del Frontend — Plataforma Multi-Negocio SportReserve

## 1. Visión General
El frontend de la plataforma deportiva multi-negocio está construido con tecnologías web estándar modernas (**HTML5 semántico**, **Vanilla CSS con tokens de diseño modernos** y **JavaScript modular Vanilla ES6+**), garantizando cero dependencias pesadas, tiempos de carga instantáneos y un diseño visual premium acorde a las mejores prácticas de UI/UX contemporáneas (modo oscuro elegante, paleta de colores HSL/hex curada, glassmorphism, microanimaciones y diseño completamente adaptable a móviles y escritorios).

---

## 2. Sistema de Diseño (Design System)

Implementado centralmente en [`frontend/css/main.css`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/css/main.css), el sistema define un conjunto de variables CSS y utilidades reutilizables:

### 2.1. Tipografía y Colores
- **Fuentes**: Google Fonts `Inter` (cuerpo de texto, alta legibilidad) y `Outfit` (encabezados, impacto visual deportivo moderno).
- **Fondo & Superficies**:
  - `--bg-dark`: `#0b0f19` (fondo principal profundo).
  - `--surface-card`: `rgba(18, 24, 38, 0.8)` con efecto `backdrop-filter: blur(12px)` (glassmorphism).
  - `--border-color`: `rgba(255, 255, 255, 0.08)`.
- **Acentos y Estados**:
  - `--primary`: `#10b981` (verde esmeralda deportivo).
  - `--primary-hover`: `#059669`.
  - `--accent`: `#06b6d4` (azul cian energético).
  - `--warning`: `#f59e0b` (ámbar para estados pendientes/caja).
  - `--danger`: `#ef4444` (rojo para cancelaciones y cierres).
  - `--text-main`: `#f8fafc`.
  - `--text-muted`: `#94a3b8`.
  - `--text-dim`: `#64748b`.

### 2.2. Componentes Base
- **Botones (`.btn`)**: Variantes `.btn-primary`, `.btn-secondary`, `.btn-accent`, `.btn-danger`, `.btn-sm`, `.btn-lg`, con transiciones suaves de elevación al interactuar.
- **Tarjetas Glassmorphism (`.card`)**: Bordes sutiles iluminados y fondos traslúcidos.
- **Badges de Estado (`.badge`)**: `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-primary`, `.badge-accent`.
- **Formularios (`.form-control`, `.form-label`, `.form-group`)**: Inputs estilizados con enfoque contrastado y tipografía clara.
- **Grid de Horarios Deportivos (`.slots-grid`, `.slot-btn`)**: Botones interactivos para selección de franjas horarias con feedback visual inmediato (disponible, seleccionado, ocupado).

---

## 3. Estructura de Módulos JavaScript

El código cliente está organizado en la carpeta [`frontend/js/`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/js/):

### 3.1. Cliente de API Centralizado ([`api.js`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/js/api.js))
- Wrapper sobre `window.fetch` para peticiones `GET`, `POST`, `PUT`, `DELETE`.
- Inyección automática del token de sesión `Authorization: Bearer <JWT>`.
- Inyección transparente de cabeceras multi-tenant (`x-negocio-id`).
- Normalización y captura de respuestas de error JSON provenientes del backend.

### 3.2. Gestión de Autenticación & Permisos ([`auth.js`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/js/auth.js))
- Almacenamiento seguro en `localStorage` de tokens y datos del usuario (`id`, `nombre`, `email`, `rol`, `negocio_id`).
- Funciones de verificación: `isAuthenticated()`, `getUser()`, `getToken()`.
- Guards de navegación cliente:
  - `requireAuth(redirectUrl)`: Redirige a login si no hay sesión activa.
  - `requireRole(rolesPermitidos)`: Bloquea accesos no autorizados y redirige a la vista correspondiente.
- Función de cierre de sesión `logout()` con invalidación por lista negra en el backend (`/api/auth/logout`).

### 3.3. Barra de Navegación Dinámica ([`navbar.js`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/js/navbar.js))
- Inyección automática en `<div id="navbar-slot"></div>` en todas las páginas.
- Enlaces contextuales por rol:
  - **Invitado / No autenticado**: Inicio, Canchas, Reservar, Iniciar Sesión, Registro.
  - **Cliente**: Inicio, Canchas, Reservar, Mis Reservas, Perfil, Salir.
  - **Recepcionista**: Inicio, Canchas, Reservar, Recepción & Caja, Salir.
  - **Admin / Superadmin**: Inicio, Canchas, Reservar, Recepción & Caja, Administración & KPIs, Salir.

---

## 4. Catálogo de Vistas y Páginas

| Archivo | Rol Destino | Funcionalidad Principal |
|---|---|---|
| [`index.html`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/index.html) | Público | Landing page, listado de centros deportivos asociados y catálogo destacado de canchas. |
| [`canchas.html`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/canchas.html) | Público | Catálogo interactivo con filtros por centro deportivo y disciplina (Fútbol, Pádel, Básquet). |
| [`reservar.html`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/reservar.html) | Cliente / Público | Selector de fecha y franja horaria en tiempo real, validación de cupones y registro de reserva con pago inicial. |
| [`mis-reservas.html`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/mis-reservas.html) | Cliente | Panel personal con historial de reservas, estados de pago y botón de cancelación directa. |
| [`login.html`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/login.html) | Público | Formulario de autenticación con redirección inteligente según el rol del usuario. |
| [`registro.html`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/registro.html) | Público | Auto-registro de clientes globales de la plataforma con validación inmediata. |
| [`recepcion.html`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/recepcion.html) | Recepcionista / Admin | Check-in de clientes con código, apertura/arqueo/cierre de turno de caja y creación de reservas presenciales. |
| [`admin.html`](file:///Users/dmedinasix/Desktop/Migracion/reservas-canchas-futbol/frontend/admin.html) | Admin / Superadmin | Tablero con métricas clave (ingresos por método, ocupación, estados), creación/edición de canchas y creación de cupones de descuento. |

---

## 5. Integración y Despliegue con Docker

El frontend se sirve como contenido estático de alto rendimiento servido directamente por la instancia Express de Node.js a través de `express.static`:
- **Ruta de montaje en Docker**: `./frontend:/app/frontend:ro`
- **Puerto de acceso unificado**: `http://localhost:3000/`
- **Fallback amigable de rutas**: `/canchas` mapea automáticamente a `canchas.html` si se omite la extensión.
- **Cabeceras de seguridad**: Helmet configurado para permitir recursos locales y tipografías externas sin restricciones indebidas de CSP en desarrollo.
