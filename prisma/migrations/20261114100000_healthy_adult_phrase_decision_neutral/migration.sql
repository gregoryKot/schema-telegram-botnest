-- Фраза пула канала была только в живой БД, мужской род («Решение я уже принял») — по правилу рода читателя
-- переводится в безличный оборот; повторный прогон ничего не находит. "updatedAt" — NOT NULL без DEFAULT.
UPDATE "HealthyAdultPhrase"
   SET "text" = replace("text", 'Решение я уже принял', 'Решение уже принято'),
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE "text" LIKE '%Решение я уже принял%';
