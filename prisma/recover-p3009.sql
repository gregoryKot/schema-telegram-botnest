-- Одноразовое восстановление после P3009 (инцидент 2026-07-16).
-- Миграция 20260716000001_healthy_adult_phrases упала на проде и застряла в
-- _prisma_migrations с finished_at IS NULL, из-за чего `migrate deploy`
-- отказывался применять что-либо. Удаляем ТОЛЬКО эту незавершённую запись,
-- чтобы deploy накатил миграцию заново (она идемпотентна).
--
-- Безопасно при повторном запуске: на здоровой БД условие finished_at IS NULL
-- не совпадает ни с чем (миграция уже применена) → удаляется 0 строк.
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260716000001_healthy_adult_phrases'
  AND finished_at IS NULL;
