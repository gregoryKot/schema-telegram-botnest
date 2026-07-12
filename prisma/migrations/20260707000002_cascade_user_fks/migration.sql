-- Аудит 2026-07, находка D-2: 10 user-таблиц не имели FK на User — удаление
-- держалось только на ручной транзакции deleteAllUserData; любой другой путь
-- удаления User оставлял сирот без единой ошибки от БД.
-- UserTask намеренно БЕЗ FK: задачи виртуальных клиентов терапевта хранятся
-- с отрицательным userId = -TherapyRelation.id (строки User не существует).
--
-- Перед созданием констрейнтов дочищаем уже осиротевшие строки — иначе
-- ADD CONSTRAINT упадёт.
DELETE FROM "Rating" t WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId");
DELETE FROM "YsqProgress" t WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId");
DELETE FROM "YsqResult" t WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId");
DELETE FROM "ChildhoodRating" t WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId");
DELETE FROM "UserPractice" t WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId");
DELETE FROM "PracticePlan" t WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId");
DELETE FROM "SchemaDiaryEntry" t WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId");
DELETE FROM "ModeDiaryEntry" t WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId");
DELETE FROM "GratitudeDiaryEntry" t WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId");
DELETE FROM "AppActivity" t WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YsqProgress" ADD CONSTRAINT "YsqProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPractice" ADD CONSTRAINT "UserPractice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticePlan" ADD CONSTRAINT "PracticePlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YsqResult" ADD CONSTRAINT "YsqResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildhoodRating" ADD CONSTRAINT "ChildhoodRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemaDiaryEntry" ADD CONSTRAINT "SchemaDiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeDiaryEntry" ADD CONSTRAINT "ModeDiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GratitudeDiaryEntry" ADD CONSTRAINT "GratitudeDiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppActivity" ADD CONSTRAINT "AppActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
