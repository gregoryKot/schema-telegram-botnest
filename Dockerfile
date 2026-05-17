FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Backend dependencies ────────────────────────────────────────────────────
COPY package*.json ./
RUN npm install

# ── Webapp dependencies ─────────────────────────────────────────────────────
COPY webapp/package*.json ./webapp/
RUN npm install --prefix webapp

# ── Telegram mini-app dependencies ─────────────────────────────────────────
COPY schema-miniapp/package*.json ./schema-miniapp/
RUN npm install --prefix schema-miniapp

# ── Copy source and build both ──────────────────────────────────────────────
COPY . .
RUN npx prisma generate
RUN npm run build

# Build webapp (website) — output goes to webapp/dist/ → served at /
RUN npm run build --prefix webapp

# Build schema-miniapp (Telegram-only) — output → schema-miniapp/dist → served at /tg
RUN npm run build --prefix schema-miniapp

# ── Prune dev deps (backend only) ──────────────────────────────────────────
RUN npm prune --production

CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/migrate-from-railway.js; node dist/main"]
