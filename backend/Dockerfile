FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias e instalar dependencias de producción
COPY package*.json ./
RUN npm ci --only=production

# Copiar el código fuente del backend
COPY . .

# Exponer el puerto de la aplicación
EXPOSE 3000

# Ejecutar como usuario sin privilegios por seguridad
USER node

# Comando de inicio
CMD ["node", "app.js"]
