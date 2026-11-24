-- Срок фазы пути необязателен: общий шаблон сроков не задаёт.
ALTER TABLE "TherapyPathPhase" ALTER COLUMN "weeks" DROP NOT NULL;
