-- Жизни процессов приложения для пробы cronLeases (аудит 2026-10, «Суточный
-- крон при частых деплоях ловится на 4-е сутки»; src/infra/self-check/
-- process-lives.ts). Проба прощала тики до старта своего процесса, и при
-- деплоях чаще раза в сутки два суточных тика никогда не попадали в жизнь
-- одного процесса. Теперь тик, на который пришлась жизнь прошлого процесса
-- (от старта или последнего отказа базы до последнего прогона пробы), тоже
-- судится. Не пользовательские данные: id — HOSTNAME и время старта.
-- Сырых INSERT нет, updatedAt нет. Миграция идемпотентна целиком.
CREATE TABLE IF NOT EXISTS "ProcessLife" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL,
    "dbFailureAt" TIMESTAMP(3),

    CONSTRAINT "ProcessLife_pkey" PRIMARY KEY ("id")
);
