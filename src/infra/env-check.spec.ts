// checkEnv — чистая функция от env (щит, инциденты 2026-09-15/16). Покрытие:
// пусто, всё ок, отсутствует обязательная (в проде и не в проде — список
// «missing» не зависит от режима, режим влияет только на то, КАК громко об
// этом сообщить — см. env-check-boot-log.spec.ts), неверный формат,
// кросс-проверки.
import { checkEnv } from './env-check';

// Минимальный набор, закрывающий все requiredInProd:true записи реестра —
// иначе checkEnv(ALL_VALID) сообщал бы о «missing» не из-за теста, а из-за
// самого реестра.
const ALL_VALID = {
  ADMIN_BOOKING_KEY: 'super-secret-key-0123456789-abcdefghij',
  ADMIN_ID: '123456789',
  BOT_TOKEN: `123456789:${'A'.repeat(35)}`,
  BOT_USERNAME: 'SchemeHappensBot',
  DATABASE_URL: 'postgres://localhost/db',
  ENCRYPTION_KEY: 'a'.repeat(64),
  JWT_SECRET: 'Zr8k2VqLx9Tn4Wc7Hb3Yd6Fm1Pj5Ug0aKs',
  WEBAPP_URL: 'https://schemehappens.ru',
};

describe('checkEnv', () => {
  it('пустой env — все requiredInProd отсутствуют, invalid и кросс-проверки пусты', () => {
    const result = checkEnv({}, 'production');
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing).toEqual(
      expect.arrayContaining(['BOT_TOKEN', 'ADMIN_ID', 'JWT_SECRET']),
    );
    expect(result.invalid).toEqual([]);
    expect(result.crossCheckIssues).toEqual([]);
  });

  it('все обязательные заданы и валидны — missing/invalid пусты', () => {
    const result = checkEnv(ALL_VALID, 'production');
    expect(result.missing).toEqual([]);
    expect(result.invalid).toEqual([]);
  });

  it('обязательная переменная отсутствует — числится в missing и в проде, и не в проде', () => {
    const env = { ...ALL_VALID, BOT_TOKEN: undefined };
    expect(checkEnv(env, 'production').missing).toContain('BOT_TOKEN');
    expect(checkEnv(env, 'development').missing).toContain('BOT_TOKEN');
  });

  it('пустая строка считается отсутствующей', () => {
    const result = checkEnv({ ...ALL_VALID, JWT_SECRET: '   ' });
    expect(result.missing).toContain('JWT_SECRET');
  });

  it('неверный формат заданной переменной — в invalid с причиной', () => {
    const result = checkEnv({ ...ALL_VALID, ADMIN_ID: 'not-a-number' });
    expect(result.invalid).toContainEqual({
      name: 'ADMIN_ID',
      problem: 'не похоже на Telegram id (ожидались только цифры)',
    });
  });

  // H2 аудита 2026-10: JWT_SECRET подписывает access/link/merge/challenge-токены
  // и выводит PKCE-verifier VK; формат nonEmpty пускал секрет из одного символа.
  it('JWT_SECRET короче 32 символов или заглушка — в invalid (в проде это error)', () => {
    const short = checkEnv({ ...ALL_VALID, JWT_SECRET: 'jwt-secret-value' });
    expect(short.invalid.map((i) => i.name)).toContain('JWT_SECRET');
    const placeholder = checkEnv({
      ...ALL_VALID,
      JWT_SECRET: 'secretsecretsecretsecretsecret12',
    });
    expect(placeholder.invalid.map((i) => i.name)).toContain('JWT_SECRET');
  });

  it('необязательная переменная с неверным форматом тоже попадает в invalid', () => {
    const result = checkEnv({ ...ALL_VALID, VK_REDIRECT_URI: 'not a url' });
    expect(result.invalid).toContainEqual({
      name: 'VK_REDIRECT_URI',
      problem: 'не похоже на URL (не парсится)',
    });
  });

  describe('кросс-проверки', () => {
    // Заглушки, не ключи.
    const POSTBOX_KEYS = {
      POSTBOX_ACCESS_KEY_ID: 'TEST_KEY_ID',
      POSTBOX_SECRET_ACCESS_KEY: 'test-secret-not-a-real-key',
    };

    it('ключи Postbox заданы без ADMIN_EMAIL/EMAIL_FROM — обе проблемы', () => {
      const result = checkEnv({ ...ALL_VALID, ...POSTBOX_KEYS });
      const ids = result.crossCheckIssues.map((i) => i.id);
      expect(ids).toContain('postboxRequiresAdminEmail');
      expect(ids).toContain('postboxRequiresEmailFrom');
      expect(ids).not.toContain('postboxKeysComeInPair');
    });

    it('ключи Postbox + ADMIN_EMAIL + EMAIL_FROM все заданы — проблем нет', () => {
      const result = checkEnv({
        ...ALL_VALID,
        ...POSTBOX_KEYS,
        ADMIN_EMAIL: 'a@b.ru',
        EMAIL_FROM: 'Bot <no-reply@b.ru>',
      });
      expect(result.crossCheckIssues).toEqual([]);
      expect(result.invalid).toEqual([]);
    });

    // Подпись запроса собирается из пары: один ключ без другого — почта
    // выключена, и это ошибка конфигурации в обе стороны.
    it.each([
      ['POSTBOX_ACCESS_KEY_ID', 'POSTBOX_SECRET_ACCESS_KEY'],
      ['POSTBOX_SECRET_ACCESS_KEY', 'POSTBOX_ACCESS_KEY_ID'],
    ])('задан только %s — проблема называет недостающий %s', (set, missing) => {
      const result = checkEnv({
        ...ALL_VALID,
        [set]: 'x',
        ADMIN_EMAIL: 'a@b.ru',
        EMAIL_FROM: 'Bot <no-reply@b.ru>',
      });
      expect(result.crossCheckIssues).toEqual([
        {
          id: 'postboxKeysComeInPair',
          problem: `${set} задан, но не задан(ы) ${missing} — без пары ключей письма не уходят`,
        },
      ]);
    });

    it('почта не настроена вовсе (ни ключей, ни адресов) — проблем нет, старт не падает', () => {
      expect(checkEnv(ALL_VALID, 'production').crossCheckIssues).toEqual([]);
      expect(
        checkEnv({ ...ALL_VALID, ADMIN_EMAIL: 'a@b.ru' }).crossCheckIssues,
      ).toEqual([]);
    });

    it('ключ Postbox с пробелом внутри — неверный формат', () => {
      const result = checkEnv({
        ...ALL_VALID,
        ...POSTBOX_KEYS,
        POSTBOX_SECRET_ACCESS_KEY: 'two words',
      });
      expect(result.invalid.map((i) => i.name)).toEqual([
        'POSTBOX_SECRET_ACCESS_KEY',
      ]);
    });

    it('VK_APP_ID без VK_REDIRECT_URI — проблема', () => {
      const result = checkEnv({ ...ALL_VALID, VK_APP_ID: 'vk1' });
      expect(result.crossCheckIssues.map((i) => i.id)).toContain(
        'vkAppRequiresRedirect',
      );
    });

    // Яндекс ID: задан ClientID — обязаны быть секрет и адрес возврата, иначе
    // рубильник держит вход выключенным, а владелец думает, что настроил его.
    const YANDEX_ID = '11c76b6012374a5c8ad05acaeca11895';

    it('YANDEX_CLIENT_ID без секрета и адреса возврата — одна проблема с обоими именами', () => {
      const result = checkEnv({ ...ALL_VALID, YANDEX_CLIENT_ID: YANDEX_ID });
      const issue = result.crossCheckIssues.find(
        (i) => i.id === 'yandexIdRequiresSecretAndRedirect',
      );
      expect(issue?.problem).toContain('YANDEX_CLIENT_SECRET');
      expect(issue?.problem).toContain('YANDEX_REDIRECT_URI');
      expect(result.invalid).toEqual([]);
    });

    it('полный набор Яндекс ID — без проблем; без переменных вовсе — тоже (вход просто выключен)', () => {
      const full = checkEnv(
        {
          ...ALL_VALID,
          YANDEX_CLIENT_ID: YANDEX_ID,
          YANDEX_CLIENT_SECRET: 'secret',
          YANDEX_REDIRECT_URI:
            'https://schemehappens.ru/api/auth/yandex/callback',
        },
        'production',
      );
      expect(full).toEqual({ missing: [], invalid: [], crossCheckIssues: [] });
      expect(checkEnv(ALL_VALID, 'production').missing).toEqual([]);
    });

    it('YANDEX_CLIENT_ID не по форме и адрес возврата по http — неверный формат', () => {
      const result = checkEnv({
        ...ALL_VALID,
        YANDEX_CLIENT_ID: 'client id',
        YANDEX_CLIENT_SECRET: 'secret',
        YANDEX_REDIRECT_URI: 'http://schemehappens.ru/api/auth/yandex/callback',
      });
      expect(result.invalid.map((i) => i.name).sort()).toEqual([
        'YANDEX_CLIENT_ID',
        'YANDEX_REDIRECT_URI',
      ]);
    });

    it('ROBOKASSA_MERCHANT_LOGIN без паролей — одна проблема с обоими именами (M3)', () => {
      const result = checkEnv({
        ...ALL_VALID,
        ROBOKASSA_MERCHANT_LOGIN: 'shop',
      });
      const issue = result.crossCheckIssues.find(
        (i) => i.id === 'robokassaLoginRequiresPasswords',
      );
      expect(issue?.problem).toContain('ROBOKASSA_PASSWORD1');
      expect(issue?.problem).toContain('ROBOKASSA_PASSWORD2');
    });

    it('ROBOKASSA_MERCHANT_LOGIN с обоими паролями — без проблемы (M3)', () => {
      const result = checkEnv({
        ...ALL_VALID,
        ROBOKASSA_MERCHANT_LOGIN: 'shop',
        ROBOKASSA_PASSWORD1: 'p1',
        ROBOKASSA_PASSWORD2: 'p2',
      });
      expect(result.crossCheckIssues.map((i) => i.id)).not.toContain(
        'robokassaLoginRequiresPasswords',
      );
    });

    // Аудит D-2: бэкапы в Yandex Object Storage включаются только полным набором.
    it('BACKUP_S3_BUCKET без остальных переменных бэкапа — проблема с их именами', () => {
      const issue = checkEnv({
        ...ALL_VALID,
        BACKUP_S3_BUCKET: 'bkt',
      }).crossCheckIssues.find(
        (i) => i.id === 'backupBucketRequiresBackupSetup',
      );
      expect(issue?.problem).toContain('BACKUP_S3_ENDPOINT');
      expect(issue?.problem).toContain('BACKUP_S3_SECRET_ACCESS_KEY');
      expect(issue?.problem).toContain('BACKUP_ENCRYPTION_KEY');
    });

    it('полный набор переменных бэкапа — без проблемы (контроль)', () => {
      const ids = checkEnv({
        ...ALL_VALID,
        BACKUP_S3_ENDPOINT: 'https://storage.yandexcloud.net',
        BACKUP_S3_BUCKET: 'bkt',
        BACKUP_S3_ACCESS_KEY_ID: 'k',
        BACKUP_S3_SECRET_ACCESS_KEY: 'a',
        BACKUP_ENCRYPTION_KEY: 'Zq8vK3mR7tYw2LpX9cB4nH6jD1sFgA5e',
      }).crossCheckIssues.map((i) => i.id);
      expect(ids).not.toContain('backupBucketRequiresBackupSetup');
      expect(ids).not.toContain('backupKeyDistinctFromEncryptionKey');
    });

    it('BACKUP_ENCRYPTION_KEY совпадает с ENCRYPTION_KEY — проблема', () => {
      const key = 'c'.repeat(64);
      const ids = checkEnv({
        ...ALL_VALID,
        ENCRYPTION_KEY: key,
        BACKUP_ENCRYPTION_KEY: key,
      }).crossCheckIssues.map((i) => i.id);
      expect(ids).toContain('backupKeyDistinctFromEncryptionKey');
    });

    it('BACKUP_RETENTION_DAYS: 3 и 31 — неверный формат, 7 и 30 — верный', () => {
      // Потолок 30 — обещание политики конфиденциальности (глава 6).
      for (const value of ['3', '31', '90']) {
        const bad = checkEnv({ ...ALL_VALID, BACKUP_RETENTION_DAYS: value });
        expect(bad.invalid.map((i) => i.name)).toContain(
          'BACKUP_RETENTION_DAYS',
        );
      }
      for (const value of ['7', '30']) {
        const ok = checkEnv({ ...ALL_VALID, BACKUP_RETENTION_DAYS: value });
        expect(ok.invalid.map((i) => i.name)).not.toContain(
          'BACKUP_RETENTION_DAYS',
        );
      }
    });

    it('ENCRYPTION_KEY_OLD содержит текущий ENCRYPTION_KEY — проблема', () => {
      const key = 'b'.repeat(64);
      const result = checkEnv({
        ...ALL_VALID,
        ENCRYPTION_KEY: key,
        ENCRYPTION_KEY_OLD: key,
      });
      expect(result.crossCheckIssues.map((i) => i.id)).toContain(
        'encryptionKeyOldDistinctFromCurrent',
      );
    });

    it('ENCRYPTION_KEY_OLD отличается от текущего — без проблемы', () => {
      const result = checkEnv({
        ...ALL_VALID,
        ENCRYPTION_KEY: 'b'.repeat(64),
        ENCRYPTION_KEY_OLD: 'c'.repeat(64),
      });
      expect(result.crossCheckIssues.map((i) => i.id)).not.toContain(
        'encryptionKeyOldDistinctFromCurrent',
      );
    });

    it('SKIP_AUTH=true в production — проблема', () => {
      const result = checkEnv(
        { ...ALL_VALID, SKIP_AUTH: 'true' },
        'production',
      );
      expect(result.crossCheckIssues.map((i) => i.id)).toContain(
        'skipAuthNotInProduction',
      );
    });

    it('SKIP_AUTH=true вне production — без проблемы (dev escape hatch легален)', () => {
      const result = checkEnv(
        { ...ALL_VALID, SKIP_AUTH: 'true' },
        'development',
      );
      expect(result.crossCheckIssues.map((i) => i.id)).not.toContain(
        'skipAuthNotInProduction',
      );
    });

    it('VK_REDIRECT_URI ведёт на редиректящийся хост — сверка делегирована oauth-redirect-config.ts', () => {
      const result = checkEnv({
        ...ALL_VALID,
        VK_APP_ID: 'vk1',
        VK_REDIRECT_URI: 'https://www.schemehappens.ru/api/auth/vk/callback',
      });
      const issue = result.crossCheckIssues.find(
        (i) => i.id === 'oauthRedirectCanonicalHost',
      );
      expect(issue?.problem).toContain('VK_REDIRECT_URI');
      expect(issue?.problem).toContain('www.schemehappens.ru');
    });

    // F-2 (аудит 2026-10): остаток CORS-origin визитки в ALLOWED_ORIGINS.
    describe('allowedOriginsNoAliasHosts', () => {
      const issue = (origins: string | undefined) =>
        checkEnv({
          ...ALL_VALID,
          ALLOWED_ORIGINS: origins,
        }).crossCheckIssues.find((i) => i.id === 'allowedOriginsNoAliasHosts');

      it('kotlarewski.* в списке — предупреждение с названием origin', () => {
        const found = issue('https://schemehappens.ru, https://kotlarewski.gr');
        expect(found?.problem).toContain('https://kotlarewski.gr');
        expect(found?.problem).not.toContain('schemehappens.ru');
      });

      it('любой TLD визитки и регистр ловятся', () => {
        expect(issue('https://www.Kotlarewski.ru')).toBeDefined();
      });

      it('контрольный: только канонический хост и мини-апп — без проблем', () => {
        expect(
          issue('https://schemehappens.ru,https://web.telegram.org'),
        ).toBeUndefined();
      });

      it('пустой/незаданный список — без проблем', () => {
        expect(issue(undefined)).toBeUndefined();
        expect(issue('')).toBeUndefined();
      });
    });
  });
});

// Аудит 2026-10 (infra#18): дефолт BOT_USERNAME вёл на старого бота, а прод это не показывал.
describe('checkEnv — имя бота', () => {
  it('BOT_USERNAME обязателен в проде: пустой env его требует', () => {
    expect(checkEnv({}, 'production').missing).toContain('BOT_USERNAME');
  });

  it('BOT_USERNAME с пробелом и «!» — формат неверен', () => {
    const result = checkEnv(
      { ...ALL_VALID, BOT_USERNAME: 'bad name!' },
      'production',
    );
    expect(result.invalid.map((i) => i.name)).toContain('BOT_USERNAME');
  });

  it('BOT_USERNAME с @ — формат неверен (в env имя без @)', () => {
    const result = checkEnv(
      { ...ALL_VALID, BOT_USERNAME: '@SchemeHappensBot' },
      'production',
    );
    expect(result.invalid.map((i) => i.name)).toContain('BOT_USERNAME');
  });
});
