FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
