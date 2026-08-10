// Реестр возможностей, зависящих от конфигурации (щит, волна 8) — класс
// «ветка, зависящая от конфигурации, деградирует МОЛЧА»: не хватает одной
// env-переменной, и фича просто не работает, а никто в системе об этом не
// узнаёт. Самый тяжёлый случай — src/utils/admin-alert.ts: без
// BOT_TOKEN/ADMIN_ID И без RESEND_API_KEY/ADMIN_EMAIL КАЖДЫЙ алерт (события
// безопасности, сбои платежей, сбои канала волн 2/3/7) улетает в никуда без
// следа — это и есть позвоночник всех рантайм-наблюдателей щита.
//
// Чистая функция от env (по умолчанию process.env) — тестируется без мутации
// глобалов. Используется и загрузочной сводкой (capability-boot-log.ts,
// ВНЕ admin-alert.ts — тот файл намеренно не зовёт Logger, см. его шапку), и
// блоком «Настройки» в /stats (src/bot/capability-metrics.format.ts).
//
// Гейт scripts/check-capability-registry.mjs сверяет, что каждая
// «if (!token/key/secret/process.env.X) return» ветка в src/** либо
// перечислена здесь (`files`), либо в
// scripts/capability-registry-baseline.json с причиной — REGISTERED_FILES в
// гейте зеркалит `files` ниже, держи их в одном PR.

export interface CapabilityStatus {
  /** Слаг для тестов/сверки. */
  id: string;
  /** Человеческое имя фичи. */
  title: string;
  /** Включена ли возможность сейчас. */
  on: boolean;
  /** Какие env-переменные её включают. */
  envVars: string[];
  /** Человеческим языком: что именно выключено и почему. */
  offReason: string;
  /** Файлы, где физически живёт молчаливая ветка (для гейта). */
  files: string[];
  /** true, если выключение — это авария сигнализации, а не просто фичи. */
  critical: boolean;
}

type Env = Record<string, string | undefined>;

const has = (env: Env, key: string): boolean => Boolean(env[key]?.trim());

/** Строит отчёт по всем известным возможностям. Чистая функция — без DI. */
export function buildCapabilityReport(
  env: Env = process.env,
): CapabilityStatus[] {
  const alertTelegram = has(env, 'BOT_TOKEN') && has(env, 'ADMIN_ID');
  const alertEmail = has(env, 'RESEND_API_KEY') && has(env, 'ADMIN_EMAIL');
  // Оба канала admin-alert.ts мертвы разом — сигнализация выключена целиком:
  // события безопасности, сбои платежей, сбои канала не долетят никуда.
  const alertDead = !alertTelegram && !alertEmail;

  return [
    {
      id: 'alertTelegram',
      title: 'Алерты админу в Telegram',
      on: alertTelegram,
      envVars: ['BOT_TOKEN', 'ADMIN_ID'],
      offReason:
        'Алерты в Telegram не уходят: не заданы BOT_TOKEN и/или ADMIN_ID.',
      files: ['src/utils/admin-alert.ts'],
      critical: alertDead,
    },
    {
      id: 'alertEmail',
      title: 'Резервные алерты админу на почту',
      on: alertEmail,
      envVars: ['RESEND_API_KEY', 'ADMIN_EMAIL'],
      offReason:
        'Резервные алерты на почту не уходят: не заданы RESEND_API_KEY и/или ADMIN_EMAIL.',
      files: ['src/utils/admin-alert.ts'],
      critical: alertDead,
    },
    {
      id: 'emailDelivery',
      title: 'Почта пользователям (magic-link, подтверждение адреса)',
      on: has(env, 'RESEND_API_KEY'),
      envVars: ['RESEND_API_KEY'],
      offReason:
        'Почта пользователям не отправляется: не задан RESEND_API_KEY.',
      files: ['src/auth/email.service.ts'],
      critical: false,
    },
    {
      id: 'zoomMeetings',
      title: 'Личные Zoom-ссылки для сессий',
      on:
        has(env, 'ZOOM_ACCOUNT_ID') &&
        has(env, 'ZOOM_CLIENT_ID') &&
        has(env, 'ZOOM_CLIENT_SECRET'),
      envVars: ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'],
      offReason:
        'Zoom не подключён: клиентам достаётся резервная комната Jitsi ' +
        '(не заданы ZOOM_ACCOUNT_ID/ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET).',
      files: ['src/booking/meeting.service.ts'],
      critical: false,
    },
    {
      id: 'legacyEncryptionMigration',
      title: 'Дошифровка старых записей при старте',
      on: has(env, 'ENCRYPTION_KEY'),
      envVars: ['ENCRYPTION_KEY'],
      offReason:
        'Дошифровка старых записей пропущена: нет ENCRYPTION_KEY (в проде ' +
        'без него процесс вообще не стартует — см. src/utils/crypto.ts, ' +
        'здесь это только dev/CI).',
      files: [
        'src/prisma/encryption-wave2.service.ts',
        'src/utils/encrypt-migration.ts',
      ],
      critical: false,
    },
    {
      id: 'threadsTokenRefresh',
      title: 'Автообновление токена Threads',
      on: has(env, 'HEALTHY_ADULT_THREADS_TOKEN'),
      envVars: ['HEALTHY_ADULT_THREADS_TOKEN'],
      offReason:
        'Канал Threads не настроен: нет стартового HEALTHY_ADULT_THREADS_TOKEN.',
      files: ['src/channel/targets/threads-token.service.ts'],
      critical: false,
    },
  ];
}

/** true, если сигнализация (оба канала admin-alert.ts) мертва целиком. */
export function isAlertChannelDead(report: CapabilityStatus[]): boolean {
  return report.some((c) => c.critical);
}
