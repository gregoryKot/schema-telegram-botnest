FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Backend dependencies ────────────────────────────────────────────────────
COPY package*.json ./
RUN npm install

# ── Webapp dependencies ─────────────────────────────────────────────────────
COPY webapp/package*.json ./webapp/
RUN npm install --prefix webapp

# ── Copy source and build both ──────────────────────────────────────────────
COPY . .
RUN npx prisma generate
RUN npm run build

# Build webapp — output goes to webapp/dist/ which NestJS will serve
RUN npm run build --prefix webapp

# ── Prune dev deps (backend only) ──────────────────────────────────────────
RUN npm prune --production

CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/migrate-from-railway.js; node dist/main"]
