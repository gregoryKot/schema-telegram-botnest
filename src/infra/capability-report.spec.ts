// Щит, волна 8: класс «ветка, зависящая от конфигурации, деградирует
// МОЛЧА». Реестр — чистая функция от env, проверяем оба состояния каждой
// возможности и критичность мёртвой сигнализации.
import { buildCapabilityReport, isAlertChannelDead } from './capability-report';

const ALL_CONFIGURED = {
  BOT_TOKEN: '123:abc',
  ADMIN_ID: '42',
  RESEND_API_KEY: 're_test',
  ADMIN_EMAIL: 'admin@example.com',
  ZOOM_ACCOUNT_ID: 'z1',
  ZOOM_CLIENT_ID: 'z2',
  ZOOM_CLIENT_SECRET: 'z3',
  ENCRYPTION_KEY: 'k'.repeat(64),
  HEALTHY_ADULT_THREADS_TOKEN: 'tok',
  JWT_SECRET: 'jwt-secret',
};

describe('buildCapabilityReport', () => {
  it('все env заданы — все возможности включены, ничего не критично', () => {
    const report = buildCapabilityReport(ALL_CONFIGURED);
    expect(report.every((c) => c.on)).toBe(true);
    expect(report.every((c) => !c.critical)).toBe(true);
  });

  it('пустой env — все возможности выключены', () => {
    const report = buildCapabilityReport({});
    expect(report.every((c) => !c.on)).toBe(true);
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
});
