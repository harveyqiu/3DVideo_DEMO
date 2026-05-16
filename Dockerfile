# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN --mount=type=secret,id=app_env,target=/app/.env npm run deploy

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5174

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY server.js ./server.js

RUN mkdir -p data uploads mat

EXPOSE 5174
CMD ["npm", "start"]
