-- Уведомления в приложении (веб-пуши, docs/PWA_PLAN.md «Фаза 4», src/push/).
-- Подписка браузера: endpoint и ключи шифрования лежат зашифрованными
-- (EncryptSchema в src/push/push-subscription.store.ts), поиск — по
-- endpointHash (sha256 от endpoint), unique глобальный: одна подписка
-- браузера — один аккаунт. Удаление аккаунта сносит подписки каскадом.
-- updatedAt — NOT NULL без DEFAULT (значение ставит Prisma); сырых INSERT
-- здесь нет. Миграция идемпотентна целиком.
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpointHash_key"
  ON "PushSubscription"("endpointHash");

-- Обычный CREATE INDEX, не CONCURRENTLY (правило №28): очередь уведомлений
-- ищет подписки пачкой по userId на каждом тике.
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx"
  ON "PushSubscription"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey'
  ) THEN
    ALTER TABLE "PushSubscription"
      ADD CONSTRAINT "PushSubscription_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
