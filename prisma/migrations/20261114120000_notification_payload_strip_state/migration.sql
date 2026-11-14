-- Старые строки очереди уведомлений хранят в payload итог дня, средние недели,
-- текст плана и задание терапевта; шаблоны эти ключи не читают. Строки остаются.

-- 1. Открытый payload (записан до шифрования): убрать ключи состояния и текстов.
UPDATE "ScheduledNotification"
SET "payload" = "payload" - ARRAY[
  'text', 'practiceText', 'planId', 'day', 'showBooking', 'needId', 'dueDate',
  'strongestNeed', 'strongest', 'strongestAvg', 'weakest', 'weakestAvg',
  'lowestNeed', 'lowestNeedId', 'yesterdayAvg'
]
WHERE jsonb_typeof("payload") = 'object'
  AND "payload" ?| ARRAY[
    'text', 'practiceText', 'planId', 'day', 'showBooking', 'needId', 'dueDate',
    'strongestNeed', 'strongest', 'strongestAvg', 'weakest', 'weakestAvg',
    'lowestNeed', 'lowestNeedId', 'yesterdayAvg'
  ];

-- День недели строкой («на пятницу»): шаблон берёт только числовой индекс.
UPDATE "ScheduledNotification"
SET "payload" = "payload" - 'weekday'
WHERE jsonb_typeof("payload") = 'object'
  AND jsonb_typeof("payload" -> 'weekday') = 'string';

-- 2. Зашифрованный payload (JSON-строка): ключей SQL не видит. Доставленная или
-- снятая строка больше не рендерится, а эти типы payload не читают вовсе.
UPDATE "ScheduledNotification"
SET "payload" = NULL
WHERE jsonb_typeof("payload") = 'string'
  AND (
    "sentAt" IS NOT NULL
    OR "cancelledAt" IS NOT NULL
    OR "type" IN ('summary', 'weekly', 'practice_reminder', 'low_streak_insight')
  );
