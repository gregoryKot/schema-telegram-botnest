-- Канал связи клиента (telegram | whatsapp | email): владелец за границей не может звонить, нужен мессенджер.
ALTER TABLE "Booking" ADD COLUMN "clientChannel" TEXT;
