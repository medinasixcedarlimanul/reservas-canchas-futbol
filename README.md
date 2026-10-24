# Plataforma de Reservas Deportivas (Multi-Negocio)

Plataforma integral y modular para la gestión y reserva de canchas y centros deportivos con arquitectura **multi-negocio** (*multi-tenant*). El sistema está diseñado de forma genérica para permitir que múltiples complejos deportivos operen de manera independiente, permitiendo a los clientes finales explorar y reservar espacios deportivos desde una cuenta unificada.

---

## 📌 Estado del Proyecto

- **Fase Actual**: Base de Datos y Persistencia.
- **Motor**: MySQL 8.0+ (InnoDB, UTF-8 `utf8mb4`).
- **Despliegue Local**: Contenedorizado con Docker y Docker Compose.
- **Próximas Fases**: Desarrollo de API REST (Backend), panel web (Frontend) y empaquetado para despliegue en la nube.

---

## 🗂 Estructura del Repositorio

```text
reservas-canchas-futbol/
├── database/
│   └── init.sql            # Script DDL consolidado (17 tablas con índices y constraints)
├── docs/
│   └── modelo-datos.md     # Documentación técnica completa, diccionario de datos y diagrama ER
├── .env.example            # Plantilla de configuración de variables de entorno
├── .gitignore              # Archivos y datos excluidos del control de versiones
├── docker-compose.yml      # Configuración del servicio MySQL en contenedor
└── README.md               # Documentación general del proyecto
```

---

## 🚀 Puesta en Marcha Rápida (Base de Datos)

### 1. Requisitos Previos
- [Docker](https://www.docker.com/) y Docker Compose (o [Colima](https://github.com/abiosoft/colima) en macOS).

### 2. Configurar Variables de Entorno
Crea una copia del archivo de ejemplo:
```bash
cp .env.example .env
```
Parámetros principales en `.env`:
- `MYSQL_DATABASE`: Nombre de la base de datos (por defecto: `reservas_db`).
- `MYSQL_USER`: Usuario de la aplicación (por defecto: `reservas_app`).
- `MYSQL_PASSWORD`: Contraseña del usuario.
- `MYSQL_PORT`: Puerto expuesto en el host (por defecto: `3307` para evitar conflictos con MySQL local).

### 3. Iniciar el Contenedor
Levanta el servicio de base de datos en segundo plano:
```bash
docker compose up -d
```
> El contenedor ejecutará automáticamente `database/init.sql` durante su primera inicialización, dejando listas todas las tablas, relaciones e índices sin datos de prueba.

### 4. Verificar el Estado
Comprueba que el contenedor se encuentre activo y saludable (`healthy`):
```bash
docker compose ps
```

### 5. Conexión a la Base de Datos
Para interactuar directamente mediante la consola interactiva de MySQL:
```bash
docker compose exec db mysql -u reservas_app -p reservas_db
```

Para detener el contenedor:
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