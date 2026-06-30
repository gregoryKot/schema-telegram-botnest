FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Backend dependencies ────────────────────────────────────────────────────
COPY package*.json ./
RUN npm install

# ── Webapp dependencies ─────────────────────────────────────────────────────
COPY webapp/package*.json ./webapp/
RUN npm install --prefix webapp

# ── Mini-app dependencies ───────────────────────────────────────────────────
COPY schema-miniapp/package*.json ./schema-miniapp/
RUN npm install --prefix schema-miniapp

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

# Build the Telegram mini-app (vite base '/app/') → served at /app by the same
# ServeStaticModule. Built from source here so it stays in sync with the code.
RUN npm run build --prefix schema-miniapp
RUN mkdir -p webapp/dist/app && cp -r schema-miniapp/dist/* webapp/dist/app/

# Build the game (vite base '/game/') → served at /game by the same ServeStatic
RUN npm run build --prefix game
RUN mkdir -p webapp/dist/game && cp -r game/dist/* webapp/dist/game/

# ── Prune dev deps (backend only) ──────────────────────────────────────────
RUN npm prune --production

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
