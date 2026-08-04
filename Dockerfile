# Multi-stage (аудит 2026-07, I-2): build-стадия с dev-зависимостями и
# исходниками, runtime-стадия — только прод-артефакты под непривилегированным
# пользователем. До этого прод-образ тянул полные node_modules webapp/game,
# TS-исходники и работал от root.

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Облегчение сборки (слабый билдер Amvera ловил OOM на `npm ci --prefix webapp`
# — npm error "Exit handler never called!", т.е. процесс прибивал kernel).
# audit строит в памяти полный граф зависимостей и ходит в реестр; fund /
# update-notifier — лишний ввод-вывод. Отключаем на всю build-стадию: это
# снижает пик памяти и время всех `npm ci` (на установленное дерево не влияет).
ENV npm_config_audit=false \
    npm_config_fund=false \
    npm_config_update_notifier=false

# Backend dependencies.
# setup-merge-drivers.mjs копируется ДО npm ci: корневой npm-хук `prepare`
# запускает его на каждом install, и без файла `npm ci` падает с ENOENT —
# ровно так деплой молча стоял с #256 по #258 (инцидент 2026-08-04). Внутри
# образа скрипт сам выходит нулём («не git-репозиторий, пропускаю»).
COPY package*.json ./
COPY scripts/setup-merge-drivers.mjs scripts/
RUN npm ci

# Webapp dependencies
COPY webapp/package*.json ./webapp/
RUN npm ci --prefix webapp

# Game dependencies
COPY game/package*.json ./game/
RUN npm ci --prefix game

# Copy source and build
COPY . .
# Метка сборки: пишется после копирования исходников, поэтому меняется вместе
# с ними. По ней `/zv log` показывает, свежий образ работает или позавчерашний
# (инцидент 31.07.2026: хостинг не смог подтянуть коммит, а пересборка молча
# собрала старое).
RUN date -u +%Y-%m-%dT%H:%M:%SZ > BUILD_INFO
RUN npx prisma generate
RUN npm run build

# Build webapp (website) — output → webapp/dist/ → served at /
# VITE_BOT_USERNAME is baked into the bundle so the Telegram Login Widget works
ENV VITE_BOT_USERNAME=SchemeHappensBot
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
# Шрифт для картинки пина Pinterest: node:22-slim идёт без шрифтов вообще,
# без него кириллица в пине превратилась бы в пустые прямоугольники.
COPY --from=build --chown=node:node /app/assets ./assets
COPY --from=build --chown=node:node /app/BUILD_INFO ./
# Front + страница техработ (dependency-free) — держат порт 3000 всю жизнь
# контейнера. См. deploy/front-server.mjs, deploy/entrypoint.mjs и CMD ниже.
COPY --from=build --chown=node:node /app/deploy ./deploy

# Непривилегированный пользователь (в node-образе уже есть `node`)
USER node

# Зависший процесс/потерянная БД видны оркестратору (см. /health).
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Точка входа — Node-супервизор (deploy/entrypoint.mjs). Front держит публичный
# порт 3000 с первой секунды; приложение слушает внутренний APP_PORT. Пока идёт
# старт (recover-p3009 → migrate deploy → буст Nest) или пока приложение
# крашлупит — клиент видит нашу страницу техработ, а не generic-503 Amvera;
# приложение подняло APP_PORT — front прозрачно проксирует на него.
# Node как PID 1 ловит SIGTERM/SIGINT и пробрасывает их дочернему процессу —
# graceful shutdown (bot.stop, prisma disconnect) сохранён.
# recover-p3009 снимает застрявшую failed-миграцию (P3009, инцидент 2026-07-16)
# идемпотентно; после стабилизации env RECOVER_CMD можно свести к `true`.
CMD ["node", "deploy/entrypoint.mjs"]
