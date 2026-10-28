FROM node:20-alpine

WORKDIR /app

# Copiar dependencias e instalar solo producción
COPY backend/package*.json ./
RUN npm ci --only=production

# Copiar código del backend y assets del frontend (imagen 100% autocontenida)
COPY backend/ ./
COPY frontend/ ./frontend/

EXPOSE 3000

USER node

CMD ["node", "app.js"]
