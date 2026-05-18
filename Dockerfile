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
RUN npm run build --prefix webapp

# Copy pre-built schema-miniapp into webapp/dist/app so it's served by the same
# ServeStaticModule at /app (built locally with vite base '/app/')
RUN mkdir -p webapp/dist/app && cp -r schema-miniapp/dist/* webapp/dist/app/

# ── Prune dev deps (backend only) ──────────────────────────────────────────
RUN npm prune --production

CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/migrate-from-railway.js; node dist/main"]
