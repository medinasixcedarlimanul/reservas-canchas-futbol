# Plataforma de Reservas Deportivas (Multi-Negocio)

Plataforma integral y modular para la gestión y reserva de canchas y centros deportivos con arquitectura **multi-negocio** (*multi-tenant*). El sistema está diseñado de forma genérica para permitir que múltiples complejos deportivos operen de manera independiente, permitiendo a los clientes finales explorar y reservar espacios deportivos desde una cuenta unificada.

---

## 📌 Estado del Proyecto

- **Fase Actual**: Base de Datos, Backend API y Frontend Web (Todos integrados y contenedorizados).
- **Motor de BD**: MySQL 8.0+ (InnoDB, UTF-8 `utf8mb4`).
- **Servidor Backend**: Node.js 20 (Express) contenedorizado en Alpine Linux.
- **Frontend**: Interfaz web moderna (HTML5, Vanilla CSS Design System, Vanilla JS ES6+) servida por el backend.
- **Despliegue Local**: Docker Compose orquestando Base de Datos + API Backend + Frontend en `http://localhost:3000`.

---

## 🗂 Estructura del Repositorio

```text
reservas-canchas-futbol/
├── backend/                # API REST en Node.js + Express
│   ├── db/                 # Conexión al pool de MySQL
│   ├── middleware/         # Autenticación JWT, roles y contexto multi-tenant
│   ├── services/           # Lógica de negocio (auth, negocios, canchas, reservas, etc.)
│   ├── controllers/        # Controladores HTTP
│   ├── routes/             # Definición de rutas y endpoints
│   ├── Dockerfile          # Imagen Docker ligera de producción
│   └── package.json        # Dependencias del backend
├── frontend/               # Interfaz de usuario web moderna (Vanilla HTML5 / CSS3 / JS)
│   ├── css/                # Sistema de diseño, tokens, glassmorphism y tema oscuro
│   ├── js/                 # API client, auth guards, navbar dinámico
│   ├── index.html          # Landing page y complejos deportivos
│   ├── canchas.html        # Catálogo filtrable de canchas
│   ├── reservar.html       # Selector de franjas horarias y reserva interactiva
│   ├── mis-reservas.html   # Historial y cancelación de reservas del cliente
│   ├── login.html          # Inicio de sesión con enrutamiento por roles
│   ├── registro.html       # Auto-registro de clientes
│   ├── recepcion.html      # Check-in presencial y arqueo/control de caja
│   └── admin.html          # Dashboard KPI, gestión de canchas y cupones
├── database/
│   └── init.sql            # Script DDL consolidado (17 tablas con índices y constraints)
├── docs/
│   ├── modelo-datos.md     # Documentación técnica de BD y diagrama ER
│   ├── arquitectura-backend.md # Especificación y endpoints de la API REST
│   └── arquitectura-frontend.md # Guía del sistema de diseño y vistas web
├── .env.example            # Plantilla de variables de entorno para Docker
├── .gitignore              # Archivos y datos excluidos del control de versiones
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

### 3. Iniciar la Plataforma (BD + Backend)
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

### 5. Comandos Útiles
- Ver logs en vivo del backend:
  ```bash
  docker compose logs -f backend
  ```
- Ingresar a la consola interactiva de MySQL:
  ```bash
  docker compose exec db mysql -u reservas_app -psecret_app_password reservas_db
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
- **Transacciones de Reserva**: `reservas` y `reservas_pendientes_pago` (control de pasarela online previa a confirmación).
- **Gestión Financiera**: `pagos`, `pagos_movimientos`, `comprobantes` (boleta/factura) y `notas_credito`.
- **Operación de Caja y Compensaciones**: `caja_turnos`, `caja_mensual`, `cupones` y `cupones_movimientos`.
- **Seguridad y Trazabilidad**: `audit_log` y `tokens_revocados` (lista negra de JWT tras logout).

> Para consultar el **diagrama relacional en Mermaid**, tipos de datos y detalle de restricciones, revisa el archivo de arquitectura en [docs/modelo-datos.md](docs/modelo-datos.md).

---

## 🌿 Convenciones de Desarrollo

- **Control de Versiones**: Flujo basado en ramas de características (`feat/*`, `fix/*`).
- **Commits**: Formato [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).