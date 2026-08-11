# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# pnpm (the repo ships a pnpm-lock.yaml).
RUN npm install -g pnpm@9

# Install deps first for better layer caching.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build the static site → /app/dist
COPY . .
RUN pnpm build

# ---------- Runtime stage ----------
FROM nginx:1.27-alpine

# SPA + /api reverse-proxy config.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets produced by Vite.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
