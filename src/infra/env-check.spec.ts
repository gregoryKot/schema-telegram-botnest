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
  ADMIN_BOOKING_KEY: 'super-secret-key',
  ADMIN_ID: '123456789',
  BOT_TOKEN: `123456789:${'A'.repeat(35)}`,
  DATABASE_URL: 'postgres://localhost/db',
  ENCRYPTION_KEY: 'a'.repeat(64),
  JWT_SECRET: 'jwt-secret-value',
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
  });
});
