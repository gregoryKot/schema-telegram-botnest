-- Отправленная или снятая строка очереди payload не хранит: его читает только
-- getDue у ждущих. Повтор чистки 20261114120000_notification_payload_strip_state
-- для строк до #1140, ушедших из очереди после неё (данные о состоянии, РКН
-- #1135); дальше обнуляет код (sentNow/cancelledNow). Повтор ничего не меняет.
UPDATE "ScheduledNotification"
SET "payload" = NULL
WHERE "payload" IS NOT NULL
  AND ("sentAt" IS NOT NULL OR "cancelledAt" IS NOT NULL);
