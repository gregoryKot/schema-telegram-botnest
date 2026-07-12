FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Backend dependencies ────────────────────────────────────────────────────
COPY package*.json ./
RUN npm install

# ── Webapp dependencies ─────────────────────────────────────────────────────
COPY webapp/package*.json ./webapp/
RUN npm install --prefix webapp

# ── Game dependencies ───────────────────────────────────────────────────────
COPY game/package*.json ./game/
RUN npm install --prefix game

# ── Copy source and build ──────────────────────────────────────────────────
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

# ── Prune dev deps (backend only) ──────────────────────────────────────────
RUN npm prune --production

# Зависший процесс/потерянная БД видны оркестратору (см. /health).
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# exec — node замещает sh как PID 1, иначе SIGTERM от оркестратора не доходит
# до node и graceful shutdown (bot.stop, prisma disconnect) никогда не срабатывает.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
