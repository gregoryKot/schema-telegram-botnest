// checkEnv — чистая функция от env (щит, инциденты 2026-09-15/16). Покрытие:
// пусто, всё ок, отсутствует обязательная (в проде и не в проде — список
// «missing» не зависит от режима, режим влияет только на то, КАК громко об
// этом сообщить — см. env-check-boot-log.spec.ts), неверный формат,
// кросс-проверки.
import { checkEnv } from './env-check';
import { BACKUP_REQUIRED_ENV_VARS } from './backup-config';

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
    const result = checkEnv({ ...ALL_VALID, GOOGLE_REDIRECT_URI: 'not a url' });
    expect(result.invalid).toContainEqual({
      name: 'GOOGLE_REDIRECT_URI',
      problem: 'не похоже на URL (не парсится)',
    });
  });

  describe('кросс-проверки', () => {
    it('RESEND_API_KEY задан без ADMIN_EMAIL/EMAIL_FROM — обе проблемы', () => {
      const result = checkEnv({ ...ALL_VALID, RESEND_API_KEY: 're_x' });
      const ids = result.crossCheckIssues.map((i) => i.id);
      expect(ids).toContain('resendRequiresAdminEmail');
      expect(ids).toContain('resendRequiresEmailFrom');
    });

    it('RESEND_API_KEY + ADMIN_EMAIL + EMAIL_FROM все заданы — проблем нет', () => {
      const result = checkEnv({
        ...ALL_VALID,
        RESEND_API_KEY: 're_x',
        ADMIN_EMAIL: 'a@b.ru',
        EMAIL_FROM: 'Bot <no-reply@b.ru>',
      });
      expect(result.crossCheckIssues).toEqual([]);
    });

    it('GOOGLE_CLIENT_ID без SECRET/REDIRECT_URI — одна проблема с обоими именами', () => {
      const result = checkEnv({ ...ALL_VALID, GOOGLE_CLIENT_ID: 'gid' });
      const issue = result.crossCheckIssues.find(
        (i) => i.id === 'googleClientRequiresSecretAndRedirect',
      );
      expect(issue?.problem).toContain('GOOGLE_CLIENT_SECRET');
      expect(issue?.problem).toContain('GOOGLE_REDIRECT_URI');
    });

    it('VK_APP_ID без VK_REDIRECT_URI — проблема', () => {
      const result = checkEnv({ ...ALL_VALID, VK_APP_ID: 'vk1' });
      expect(result.crossCheckIssues.map((i) => i.id)).toContain(
        'vkAppRequiresRedirect',
      );
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

    // Аудит D-2: бэкапы в R2 включаются только полным набором.
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
        BACKUP_S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
        BACKUP_S3_BUCKET: 'bkt',
        BACKUP_S3_ACCESS_KEY_ID: 'k',
        BACKUP_S3_SECRET_ACCESS_KEY: 'a',
        BACKUP_ENCRYPTION_KEY: 'Zq8vK3mR7tYw2LpX9cB4nH6jD1sFgA5e',
      }).crossCheckIssues.map((i) => i.id);
      expect(ids).not.toContain('backupBucketRequiresBackupSetup');
      expect(ids).not.toContain('backupKeyDistinctFromEncryptionKey');
    });

    // Аудит 2026-10 (infra#11): на VPS pgdata — единственная копия базы.
    describe('vpsRequiresBackups', () => {
      const ids = (env: Record<string, string>, mode = 'production') =>
        checkEnv({ ...ALL_VALID, ...env }, mode).crossCheckIssues.map(
          (i) => i.id,
        );
      // Значения валидны по формату реестра; имена — из единственного
      // источника, а не литералами.
      const FORMAT_OK: Record<string, string> = {
        BACKUP_S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
        BACKUP_S3_BUCKET: 'bkt',
        BACKUP_S3_ACCESS_KEY_ID: 'k',
        BACKUP_S3_SECRET_ACCESS_KEY: 'a',
        BACKUP_ENCRYPTION_KEY: 'Zq8vK3mR7tYw2LpX9cB4nH6jD1sFgA5e',
      };
      const FULL_BACKUP: Record<string, string> = Object.fromEntries(
        BACKUP_REQUIRED_ENV_VARS.map((n) => [n, FORMAT_OK[n]]),
      );

      it('DEPLOY_TARGET=vps в production без бэкапов — проблема с именами всех пяти', () => {
        const issue = checkEnv(
          { ...ALL_VALID, DEPLOY_TARGET: 'vps' },
          'production',
        ).crossCheckIssues.find((i) => i.id === 'vpsRequiresBackups');
        for (const name of BACKUP_REQUIRED_ENV_VARS) {
          expect(issue?.problem).toContain(name);
        }
      });

      it('на VPS не хватает одной — проблема называет именно её', () => {
        const issue = checkEnv(
          {
            ...ALL_VALID,
            ...FULL_BACKUP,
            DEPLOY_TARGET: 'vps',
            BACKUP_S3_SECRET_ACCESS_KEY: undefined,
          },
          'production',
        ).crossCheckIssues.find((i) => i.id === 'vpsRequiresBackups');
        expect(issue?.problem).toContain('BACKUP_S3_SECRET_ACCESS_KEY');
        expect(issue?.problem).not.toContain('BACKUP_S3_BUCKET');
      });

      it('контроль: vps с полным набором, Amvera без бэкапов, vps вне production — без проблемы', () => {
        expect(ids({ DEPLOY_TARGET: 'vps', ...FULL_BACKUP })).not.toContain(
          'vpsRequiresBackups',
        );
        expect(ids({})).not.toContain('vpsRequiresBackups');
        expect(ids({ DEPLOY_TARGET: 'amvera' })).not.toContain(
          'vpsRequiresBackups',
        );
        expect(ids({ DEPLOY_TARGET: 'vps' }, 'development')).not.toContain(
          'vpsRequiresBackups',
        );
      });

      it('DEPLOY_TARGET с опечаткой — неверный формат, а не молчаливая Amvera', () => {
        const bad = checkEnv({ ...ALL_VALID, DEPLOY_TARGET: 'vps2' });
        expect(bad.invalid.map((i) => i.name)).toContain('DEPLOY_TARGET');
      });
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

    it('GOOGLE_REDIRECT_URI ведёт на редиректящийся хост — сверка делегирована oauth-redirect-config.ts', () => {
      const result = checkEnv({
        ...ALL_VALID,
        GOOGLE_CLIENT_ID: 'gid',
        GOOGLE_CLIENT_SECRET: 'gsecret',
        GOOGLE_REDIRECT_URI:
          'https://www.schemehappens.ru/api/auth/google/callback',
      });
      const issue = result.crossCheckIssues.find(
        (i) => i.id === 'oauthRedirectCanonicalHost',
      );
      expect(issue?.problem).toContain('GOOGLE_REDIRECT_URI');
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

// Аудит 2026-10 (infra#18): дефолты MINIAPP_URL/BOT_USERNAME вели на старый
// деплой и старого бота, а прод это не показывал.
describe('checkEnv — имя бота и адрес мини-аппа', () => {
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

  describe('miniappUrlCanonicalHost', () => {
    const issue = (url: string | undefined, mode: string) =>
      checkEnv({ ...ALL_VALID, MINIAPP_URL: url }, mode).crossCheckIssues.find(
        (i) => i.id === 'miniappUrlCanonicalHost',
      );

    it('старый vercel-деплой в проде — проблема с названием хоста', () => {
      expect(
        issue('https://schema-miniapp.vercel.app', 'production')?.problem,
      ).toContain('schema-miniapp.vercel.app');
    });

    it('www. редиректится сам — проблема', () => {
      expect(
        issue('https://www.schemehappens.ru/app/', 'production'),
      ).toBeDefined();
    });

    it('канонический хост без /app/ — проблема про путь', () => {
      expect(
        issue('https://schemehappens.ru/', 'production')?.problem,
      ).toContain('/app/');
    });

    it('контрольный: https://schemehappens.ru/app/ — чисто', () => {
      expect(
        issue('https://schemehappens.ru/app/', 'production'),
      ).toBeUndefined();
    });

    it('не в проде чужой хост законен (localhost, staging)', () => {
      expect(
        issue('https://schema-miniapp.vercel.app', 'development'),
      ).toBeUndefined();
    });

    it('MINIAPP_URL не задан — дефолт из APP_URL, проверять нечего', () => {
      expect(issue(undefined, 'production')).toBeUndefined();
    });
  });
});
