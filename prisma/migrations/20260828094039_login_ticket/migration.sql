-- Билет входа: тот же механизм RFC 8628, что и привязка устройства, но теперь
-- ещё и для пустого контейнера (ярлык/вкладка без сессии). Отсюда новое имя
-- таблицы, необязательный `userId` (у входа хозяина ещё нет) и `intent`.
--
-- Переименование вместо DROP+CREATE, который предложил `migrate dev`: строки
-- живут пять минут, но терять их у людей посреди привязки незачем, а
-- переименование таблицы, ограничений и индексов — операция над метаданными.
ALTER TABLE "DeviceLinkRequest" RENAME TO "LoginTicket";

ALTER TABLE "LoginTicket" RENAME CONSTRAINT "DeviceLinkRequest_pkey" TO "LoginTicket_pkey";
ALTER TABLE "LoginTicket" RENAME CONSTRAINT "DeviceLinkRequest_userId_fkey" TO "LoginTicket_userId_fkey";

ALTER INDEX "DeviceLinkRequest_deviceCodeHash_key" RENAME TO "LoginTicket_deviceCodeHash_key";
ALTER INDEX "DeviceLinkRequest_userCodeHash_key" RENAME TO "LoginTicket_userCodeHash_key";
ALTER INDEX "DeviceLinkRequest_userId_idx" RENAME TO "LoginTicket_userId_idx";
ALTER INDEX "DeviceLinkRequest_expiresAt_idx" RENAME TO "LoginTicket_expiresAt_idx";

-- Вход начинается без хозяина: билет создаёт контейнер, у которого сессии нет.
ALTER TABLE "LoginTicket" ALTER COLUMN "userId" DROP NOT NULL;

-- Дефолты подобраны так, что уже существующие строки остаются прежней
-- привязкой устройства и ведут себя как раньше.
ALTER TABLE "LoginTicket" ADD COLUMN "intent" TEXT NOT NULL DEFAULT 'link';
ALTER TABLE "LoginTicket" ADD COLUMN "hostId" TEXT NOT NULL DEFAULT 'web';
ALTER TABLE "LoginTicket" ADD COLUMN "deviceLabel" TEXT NOT NULL DEFAULT '';
-- «Это не я» при сверке кода — отказ обязан быть виден опросу, а не выглядеть
-- как истёкший билет.
ALTER TABLE "LoginTicket" ADD COLUMN "deniedAt" TIMESTAMP(3);
