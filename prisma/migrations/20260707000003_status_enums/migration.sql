-- Аудит 2026-07, D-3: статусы из голых String в enum — БД теперь защищает
-- от опечатки/рассинхрона значений.
--
-- ВАЖНО: prisma migrate diff генерирует здесь DROP COLUMN + ADD COLUMN,
-- что уничтожило бы данные (все статусы сбросились бы в 'pending': активные
-- связи терапевтов, оплаченные донаты). Поэтому миграция написана вручную
-- через ALTER TYPE ... USING — данные кастуются на месте; неожиданное
-- значение в данных валит миграцию (fail-safe), индексы сохраняются.

CREATE TYPE "RelationStatus" AS ENUM ('pending', 'active');
CREATE TYPE "RequestStatus" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed');
CREATE TYPE "SubscriptionStatus" AS ENUM ('pending', 'active', 'cancelled', 'past_due');

ALTER TABLE "TherapistRequest"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "RequestStatus" USING "status"::"RequestStatus",
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "Pair"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "RelationStatus" USING "status"::"RelationStatus",
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "TherapyRelation"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "RelationStatus" USING "status"::"RelationStatus",
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "Donation"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus",
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "Subscription"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SubscriptionStatus" USING "status"::"SubscriptionStatus",
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "SubscriptionCharge"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus",
  ALTER COLUMN "status" SET DEFAULT 'pending';
