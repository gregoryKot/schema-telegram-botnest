// Щит, волна 8: класс «ветка, зависящая от конфигурации, деградирует
// МОЛЧА». Реестр — чистая функция от env, проверяем оба состояния каждой
// возможности и критичность мёртвой сигнализации.
import { existsSync } from 'fs';
import { join } from 'path';
import { buildCapabilityReport, isAlertChannelDead } from './capability-report';

const ALL_CONFIGURED = {
  BOT_TOKEN: '123:abc',
  ADMIN_ID: '42',
  RESEND_API_KEY: 're_test',
  ADMIN_EMAIL: 'admin@example.com',
  ZOOM_ACCOUNT_ID: 'z1',
  ZOOM_CLIENT_ID: 'z2',
  ZOOM_CLIENT_SECRET: 'z3',
  APPLE_ID: 'me@icloud.com',
  APPLE_APP_PASSWORD: 'app-pass',
  ENCRYPTION_KEY: 'k'.repeat(64),
  HEALTHY_ADULT_THREADS_TOKEN: 'tok',
  JWT_SECRET: 'jwt-secret',
  BACKUP_S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
  BACKUP_S3_BUCKET: 'b',
  BACKUP_S3_ACCESS_KEY_ID: 'k',
  BACKUP_S3_SECRET_ACCESS_KEY: 'a',
  BACKUP_ENCRYPTION_KEY: 'x'.repeat(40),
  // Приём оплаты (аудит 2026-10-11) — тоже «настроено».
  ROBOKASSA_MERCHANT_LOGIN: 'shop',
  ROBOKASSA_PASSWORD1: 'p1',
  ROBOKASSA_PASSWORD2: 'p2',
};

describe('buildCapabilityReport', () => {
  it('все env заданы — все возможности включены, ничего не критично', () => {
    const report = buildCapabilityReport(ALL_CONFIGURED);
    expect(report.every((c) => c.on)).toBe(true);
    expect(report.every((c) => !c.critical)).toBe(true);
  });

  it('пустой env — все возможности выключены (кроме oauthRedirectSane — у неё инверсная семантика: нечего проверять = on)', () => {
    const report = buildCapabilityReport({});
    expect(
      report.filter((c) => c.id !== 'oauthRedirectSane').every((c) => !c.on),
    ).toBe(true);
    expect(report.find((c) => c.id === 'oauthRedirectSane')!.on).toBe(true);
  });

  it('оба алерт-канала не настроены — обе записи критичны', () => {
    const report = buildCapabilityReport({});
    const alertTelegram = report.find((c) => c.id === 'alertTelegram')!;
    const alertEmail = report.find((c) => c.id === 'alertEmail')!;
    expect(alertTelegram.critical).toBe(true);
    expect(alertEmail.critical).toBe(true);
    expect(isAlertChannelDead(report)).toBe(true);
  });

  it('хотя бы один алерт-канал настроен — ни одна запись не критична', () => {
    const report = buildCapabilityReport({
      BOT_TOKEN: '123:abc',
      ADMIN_ID: '42',
    });
    expect(report.find((c) => c.id === 'alertTelegram')!.on).toBe(true);
    expect(report.every((c) => !c.critical)).toBe(true);
    expect(isAlertChannelDead(report)).toBe(false);
  });

  it('пустая строка/пробелы в env — как будто переменная не задана', () => {
    const report = buildCapabilityReport({ BOT_TOKEN: '   ', ADMIN_ID: '' });
    expect(report.find((c) => c.id === 'alertTelegram')!.on).toBe(false);
  });

  it('emailDelivery независим от алерт-каналов — свой RESEND_API_KEY', () => {
    const report = buildCapabilityReport({ RESEND_API_KEY: 're_test' });
    expect(report.find((c) => c.id === 'emailDelivery')!.on).toBe(true);
    expect(report.find((c) => c.id === 'alertEmail')!.on).toBe(false);
  });

  it('zoomMeetings требует все три переменные разом', () => {
    const partial = buildCapabilityReport({
      ZOOM_ACCOUNT_ID: 'z1',
      ZOOM_CLIENT_ID: 'z2',
    });
    expect(partial.find((c) => c.id === 'zoomMeetings')!.on).toBe(false);
  });

  it('у каждой записи есть непустой offReason и непустой files', () => {
    for (const c of buildCapabilityReport({})) {
      expect(c.offReason.length).toBeGreaterThan(10);
      expect(c.files.length).toBeGreaterThan(0);
    }
  });

  it('каждый путь из files существует в репозитории (протухший путь делает запись декорацией)', () => {
    const root = join(__dirname, '..', '..');
    const missing = buildCapabilityReport({}).flatMap((c) =>
      c.files.filter((f) => !existsSync(join(root, f))),
    );
    expect(missing).toEqual([]);
  });

  it('legacyEncryptionMigration: включается ENCRYPTION_KEY, files — миграция, классификатор строк и итог для пробы', () => {
    const off = buildCapabilityReport({}).find(
      (c) => c.id === 'legacyEncryptionMigration',
    )!;
    expect(off.on).toBe(false);
    expect(off.critical).toBe(false);
    const on = buildCapabilityReport({ ENCRYPTION_KEY: 'k'.repeat(64) }).find(
      (c) => c.id === 'legacyEncryptionMigration',
    )!;
    expect(on.on).toBe(true);
    expect(on.files).toEqual(
      expect.arrayContaining([
        'src/utils/encrypt-migration.ts',
        'src/utils/encrypt-migration.rows.ts',
        'src/infra/self-check/clinical-labels-status.ts',
      ]),
    );
  });

  // 2026-09-16: GOOGLE_REDIRECT_URI/VK_REDIRECT_URI на legacy/www-хосте
  // зацикливали редирект колбэка с хостовым мидлваром main.ts — отдельная
  // запись реестра ловит это до первой жалобы пользователя.
  it('oauthRedirectSane: канонический адрес возврата — on (контроль)', () => {
    const report = buildCapabilityReport({
      GOOGLE_REDIRECT_URI: 'https://schemehappens.ru/api/auth/google/callback',
    });
    expect(report.find((c) => c.id === 'oauthRedirectSane')!.on).toBe(true);
  });

  it('oauthRedirectSane: адрес возврата на legacy-хосте — off, не критично', () => {
    const report = buildCapabilityReport({
      GOOGLE_REDIRECT_URI: 'https://schemalab.ru/api/auth/google/callback',
    });
    const cap = report.find((c) => c.id === 'oauthRedirectSane')!;
    expect(cap.on).toBe(false);
    expect(cap.critical).toBe(false);
  });
  // Аудит D-2: бэкапы в R2 включает только полный набор переменных.
  it('dbBackups: нет переменных — off, причина называет их, не критично', () => {
    const cap = buildCapabilityReport({}).find((c) => c.id === 'dbBackups')!;
    expect(cap.on).toBe(false);
    expect(cap.critical).toBe(false);
    expect(cap.offReason).toContain('BACKUP_S3_ACCESS_KEY_ID');
    expect(cap.offReason).toContain('BACKUP_ENCRYPTION_KEY');
  });

  it('dbBackups: не хватает одной переменной — off и называет именно её', () => {
    const cap = buildCapabilityReport({
      BACKUP_S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
      BACKUP_S3_BUCKET: 'b',
      BACKUP_S3_ACCESS_KEY_ID: 'k',
      BACKUP_S3_SECRET_ACCESS_KEY: 'a',
    }).find((c) => c.id === 'dbBackups')!;
    expect(cap.on).toBe(false);
    expect(cap.offReason).toContain('BACKUP_ENCRYPTION_KEY');
    expect(cap.offReason).not.toContain('BACKUP_S3_BUCKET');
  });
});
