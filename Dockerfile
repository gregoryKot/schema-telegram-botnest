FROM node:18-slim
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

RUN npm prune --production

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
