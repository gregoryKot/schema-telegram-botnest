# Multi-stage (аудит 2026-07, I-2): build-стадия с dev-зависимостями и
# исходниками, runtime-стадия — только прод-артефакты под непривилегированным
# пользователем. До этого прод-образ тянул полные node_modules webapp/game,
# TS-исходники и работал от root.

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Backend dependencies
COPY package*.json ./
RUN npm ci

# Webapp dependencies
COPY webapp/package*.json ./webapp/
RUN npm ci --prefix webapp

# Game dependencies
COPY game/package*.json ./game/
RUN npm ci --prefix game

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

# Build webapp (website) — output → webapp/dist/ → served at /
# VITE_BOT_USERNAME is baked into the bundle so the Telegram Login Widget works
ENV VITE_BOT_USERNAME=SchemaLabBot
RUN npm run build --prefix webapp

# Copy the pre-built Telegram mini-app into webapp/dist/app → served at /app by
# the same ServeStaticModule. The mini-app is built from its committed source
# (`npm run build --prefix schema-miniapp`) and its dist committed — this keeps
# the Docker build fast (no extra install/build step here).
RUN mkdir -p webapp/dist/app && cp -r schema-miniapp/dist/* webapp/dist/app/

# Build the game (vite base '/game/') → served at /game by the same ServeStatic
RUN npm run build --prefix game
RUN mkdir -p webapp/dist/game && cp -r game/dist/* webapp/dist/game/

# Только прод-зависимости бэкенда едут в runtime (prisma CLI — в dependencies,
# он нужен для `migrate deploy` на старте)
RUN npm prune --production

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.js ./
COPY --from=build --chown=node:node /app/webapp/dist ./webapp/dist

# Непривилегированный пользователь (в node-образе уже есть `node`)
USER node

# Зависший процесс/потерянная БД видны оркестратору (см. /health).
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# exec — node замещает sh как PID 1, иначе SIGTERM от оркестратора не доходит
# до node и graceful shutdown (bot.stop, prisma disconnect) никогда не срабатывает.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
