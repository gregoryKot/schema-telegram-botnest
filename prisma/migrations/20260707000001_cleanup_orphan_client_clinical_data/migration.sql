-- Аудит 2026-07, находка D-1: deleteAllUserData чистил ClientConceptualization
-- и TherapistNote только по therapistId. Когда аккаунт удалял КЛИЕНТ,
-- клинические записи о нём (schemaIds, unmetNeeds, triggers, текст заметок)
-- оставались в БД навсегда — нарушение right-to-erasure.
-- Код исправлен (OR clientId); эта миграция дочищает уже осиротевшие строки.
--
-- clientId > 0 — только реальные пользователи. Виртуальные клиенты
-- (clientId < 0 = -TherapyRelation.id) не имеют строки в User и здесь
-- не трогаются (их чистила миграция 20260609000001).
DELETE FROM "ClientConceptualization" cc
WHERE cc."clientId" > 0
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = cc."clientId");

DELETE FROM "TherapistNote" tn
WHERE tn."clientId" > 0
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = tn."clientId");
