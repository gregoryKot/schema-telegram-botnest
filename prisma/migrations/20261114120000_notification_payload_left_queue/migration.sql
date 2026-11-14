-- Отправленная или снятая строка очереди payload больше не читает: его читает
-- только getDue у ждущих. У строк до #1140 в нём итог дня, средние недели,
-- текст плана и задание терапевта (РКН, #1135). payload зашифрован целиком в
-- приложении, ключи SQL не вырезать — обнуляется колонка; новые строки при
-- уходе из очереди обнуляет код (sentNow/cancelledNow). Повтор ничего не меняет.
UPDATE "ScheduledNotification"
SET "payload" = NULL
WHERE "payload" IS NOT NULL
  AND ("sentAt" IS NOT NULL OR "cancelledAt" IS NOT NULL);
