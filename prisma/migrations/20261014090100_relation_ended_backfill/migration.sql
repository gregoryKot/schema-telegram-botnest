-- Бэкфил к 20261014090000_relation_status_ended: связи, осиротевшие до
-- появления статуса `ended` (терапевт отказался от роли, строки остались
-- active/pending), завершаются. Иначе клиент продолжает видеть бывшего
-- терапевта в «Моём терапевте». Колонки updatedAt у TherapyRelation нет,
-- прочих NOT NULL без дефолта UPDATE не касается. Идемпотентно: повторный
-- прогон не находит строк.
UPDATE "TherapyRelation"
SET "status" = 'ended'
WHERE "status" IN ('active', 'pending')
  AND "therapistId" IN (SELECT "id" FROM "User" WHERE "role" <> 'THERAPIST');
