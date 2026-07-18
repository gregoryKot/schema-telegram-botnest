-- Одноразовое восстановление после P3009.
-- Инцидент 2026-07-16 (v2): миграция 20260716120000_healthy_adult_ai_pool
-- упала на проде (сырой INSERT не заполнял updatedAt NOT NULL) и застряла в
-- _prisma_migrations с finished_at IS NULL, из-за чего `migrate deploy`
-- отказывался применять что-либо (P3009). Удаляем ТОЛЬКО эту незавершённую
-- запись — deploy накатит уже исправленную (идемпотентную) миграцию заново.
--
-- Безопасно при повторном запуске: на здоровой БД условие finished_at IS NULL
-- не совпадает (миграция уже применена) → удаляется 0 строк.
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260716120000_healthy_adult_ai_pool'
  AND finished_at IS NULL;

-- Инцидент 2026-07-18: 20260717182526_analytics_events упала на проде
-- (CREATE TABLE без IF NOT EXISTS, объект уже существовал → 42P07 → P3009).
-- Снимаем незавершённую запись — deploy накатит уже идемпотентную версию.
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260717182526_analytics_events'
  AND finished_at IS NULL;
