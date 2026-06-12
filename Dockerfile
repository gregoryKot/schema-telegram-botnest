FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Backend dependencies ────────────────────────────────────────────────────
COPY package*.json ./
RUN npm install

# ── Webapp dependencies ─────────────────────────────────────────────────────
COPY webapp/package*.json ./webapp/
RUN npm install --prefix webapp

# ── Copy source and build ──────────────────────────────────────────────────
COPY . .
RUN npx prisma generate
RUN npm run build

# Build webapp (website) — output → webapp/dist/ → served at /
# VITE_BOT_USERNAME is baked into the bundle so the Telegram Login Widget works
ENV VITE_BOT_USERNAME=SchemaLabBot
RUN npm run build --prefix webapp

# Copy pre-built schema-miniapp into webapp/dist/app so it's served by the same
# ServeStaticModule at /app (built locally with vite base '/app/')
RUN mkdir -p webapp/dist/app && cp -r schema-miniapp/dist/* webapp/dist/app/

# Copy pre-built game into webapp/dist/game — served at /game
# (built locally with vite base '/game/', dist committed like the miniapp)
RUN mkdir -p webapp/dist/game && cp -r game/dist/* webapp/dist/game/

# ── Prune dev deps (backend only) ──────────────────────────────────────────
RUN npm prune --production

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
