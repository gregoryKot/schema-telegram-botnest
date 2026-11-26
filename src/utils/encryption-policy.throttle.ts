// Вынесено из encryption-policy.ts (правило №10 CLAUDE.md: файл упёрся в
// потолок бейслайна файл-храповика — раздутый файл дробится на модуль, а не
// растёт дальше; тот же приём, что уже применён в encryption-policy.infra.ts).
import { Policy, ID, plain, enc } from './encryption-policy';

export const THROTTLE_FIELD_POLICY: Record<string, Record<string, Policy>> = {
  ScheduledNotification: {
    type: ID,
    // Аудит 2026-10 (T1): в payload ложились текст задания терапевта, текст
    // практики и имя терапевта открытым текстом. Шифруем allow-list текстовых
    // ключей (PAYLOAD_TEXT_KEYS), числа/needId остаются открытыми для шаблонов.
    payload: enc('src/notification/notification.service.ts'),
  },
  // Инцидент 2026-09-13: троттлинг денежных/заявочных ручек переехал в
  // Postgres (src/api/postgres-throttle-storage.ts). userId у модели нет —
  // это не пользовательские данные (чеклист CLAUDE.md «Новая таблица» на
  // ThrottleHit не распространяется).
  ThrottleHit: {
    key: plain(
      'sha256 от маршрута+бакета (ThrottlerGuard.generateKey), а не от ' +
        'свободного текста — PII в ключе нет',
    ),
  },
};
