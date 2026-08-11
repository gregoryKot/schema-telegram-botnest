// Форматтер блока «Настройки» в /stats: полное состояние (пустое — в смысле
// «нечего показать»), частичная деградация и мёртвая сигнализация одной
// строкой (правило №8: язык простой, без RESEND_API_KEY-жаргона в описании
// критичности).
import { formatCapabilityReport } from './capability-metrics.format';
import { buildCapabilityReport } from '../infra/capability-report';

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
};

describe('formatCapabilityReport', () => {
  it('всё настроено (пустое состояние выключенного) — одна короткая строка', () => {
    const text = formatCapabilityReport(buildCapabilityReport(ALL_CONFIGURED));
    expect(text).toBe(
      '⚙️ <b>Настройки</b>: всё подключено, ничего не отключено.',
    );
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('оба алерт-канала выключены — одна красная строка без дублей', () => {
    const text = formatCapabilityReport(buildCapabilityReport({}));
    const critLines = text
      .split('\n')
      .filter((l) => l.includes('сигнализация мертва'));
    expect(critLines).toHaveLength(1);
    expect(text).toContain('🔴');
  });

  it('частичная деградация — обычные строки человеческим языком, без жаргона переменных в заголовке', () => {
    const text = formatCapabilityReport(
      buildCapabilityReport({
        BOT_TOKEN: '123:abc',
        ADMIN_ID: '42',
        RESEND_API_KEY: 're_test',
        ADMIN_EMAIL: 'admin@example.com',
      }),
    );
    expect(text).toContain('Zoom не подключён');
    expect(text).toContain('Threads не настроен');
    expect(text).not.toContain('🔴');
  });

  it('пустой env: перечисляет каждую выключенную возможность одной строкой', () => {
    const text = formatCapabilityReport(buildCapabilityReport({}));
    expect(text).toContain('Почта пользователям не отправляется');
    expect(text).toContain('Дошифровка старых записей пропущена');
  });
});
