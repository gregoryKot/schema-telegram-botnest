# Multi-stage (аудит 2026-07, I-2): build-стадия с dev-зависимостями и
# исходниками, runtime-стадия — только прод-артефакты под непривилегированным
# пользователем. До этого прод-образ тянул полные node_modules webapp/game,
# TS-исходники и работал от root.

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-slim AS build
# openssl (нужен движку Prisma) ставится скриптом с повтором и запасным
# зеркалом: см. deploy/install-openssl.sh — сеть билдера Amvera до
# deb.debian.org отваливается, и сборка не обязана падать с первой попытки.
COPY deploy/install-openssl.sh /tmp/
RUN sh /tmp/install-openssl.sh && rm /tmp/install-openssl.sh
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
# merge-drivers-check.mjs — его статический импорт (логика `--check`): без
# него скрипт падает с ERR_MODULE_NOT_FOUND ещё до разбора аргументов.
COPY package*.json ./
COPY scripts/setup-merge-drivers.mjs scripts/merge-drivers-check.mjs scripts/
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
# Google One Tap (webapp/src/hooks/useGoogleOneTap.ts): публичный client id
# OAuth-клиента Google — тот же, что GOOGLE_CLIENT_ID бэкенда (он виден в
# редиректе кнопки «Войти через Google»). Origin https://schemehappens.ru для
# него разрешён в Google Cloud Console (проверено 2026-10-24: gsi/status → 200).
# Без переменной окно «Продолжить как…» молча не показывалось никому (аудит
# 2026-10, п.16). Сверка — src/test-support/gates/google-one-tap-build.spec.ts.
ARG VITE_GOOGLE_CLIENT_ID=283410385894-d4fu4fmchc8baq5e0rla4n607shtihth.apps.googleusercontent.com
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
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
COPY deploy/install-openssl.sh /tmp/
RUN sh /tmp/install-openssl.sh && rm /tmp/install-openssl.sh
# pg_dump/psql 16 и curl — для зашифрованных бэкапов в R2 (deploy/backup-scheduler.cjs
# → scripts/backup-upload.sh). Только в runtime: в build-стадии они не нужны.
COPY deploy/install-pg-client.sh /tmp/
RUN sh /tmp/install-pg-client.sh && rm /tmp/install-pg-client.sh
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
# Каталог едет целиком: в нём и deploy/transfer-db.sh (разовый перенос БД на VPS,
# запускается через RECOVER_CMD, docs/MIGRATION_VPS.md), и deploy/vps/ (серверу он
# в образе не нужен, но лишним не мешает).
COPY --from=build --chown=node:node /app/deploy ./deploy
# Скрипты бэкапа/восстановления: планировщик в deploy/ запускает backup-upload.sh,
# restore-backup.sh нужен владельцу при аварии (оба читают deploy/pg-url-env.cjs).
# backup-fetch-latest.sh скачивает свежий бэкап из R2 (op=restore-backup, docs/MIGRATION_VPS.md);
# s3-api.sh — общий вход в хранилище (подпись SigV4 curl-ом), его подключают оба.
COPY --from=build --chown=node:node /app/scripts/backup-upload.sh /app/scripts/restore-backup.sh /app/scripts/backup-fetch-latest.sh /app/scripts/s3-api.sh ./scripts/

# Непривилегированный пользователь (в node-образе уже есть `node`)
USER node

# Зависший процесс/потерянная БД/парковка на техработах видны оркестратору.
# Смотрим ТЕЛО /health, а не код: front (deploy/front-server.mjs) отвечает 200
# страницей техработ на любой путь, и по r.ok запаркованный контейнер был бы
# «здоров». Маркер тот же, что в deploy/vps/ops.sh и prod-smoke.yml. HEALTHCHECK
# ничего не перезапускает, он даёт честный статус (unhealthy в `op=status`).
# 127.0.0.1 (front слушает IPv4); redirect:'manual' — хостовый редирект не
# уведёт проверку на внешний прод.
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',{redirect:'manual'}).then(r=>r.text()).then(t=>process.exit(t.includes('\"status\":\"ok\"')?0:1)).catch(()=>process.exit(1))"

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
