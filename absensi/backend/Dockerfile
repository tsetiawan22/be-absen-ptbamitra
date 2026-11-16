# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY sql ./sql

EXPOSE 3000

# shortcut: auto-migrate saat start container, aman karena migrate.ts idempoten
CMD ["sh", "-c", "node dist/config/migrate.js && node dist/main.js"]

