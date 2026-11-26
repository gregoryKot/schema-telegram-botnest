// @vitest-environment jsdom
// Сообщение об отказе входа: сказать достаточно, чтобы понять поломку, и
// ничего лишнего наружу. Отчёт уходит в логи и в личку админу — значений
// подписи и текста пользователя в нём быть не должно.
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  AUTH_FAILURE_SECTION,
  buildAuthFailureMessage,
  useAuthFailureReport,
} from './authFailureReport';

describe('buildAuthFailureMessage', () => {
  it('называет площадку и то, что подписи не было — ровно случай инцидента', () => {
    const msg = buildAuthFailureMessage({
      hostId: 'max',
      signaturePresent: false,
      error: 'Error: 401 Unauthorized',
    });
    expect(msg).toContain('хост=max');
    expect(msg).toContain('подпись ПУСТАЯ');
    expect(msg).toContain('401');
  });

  it('различает «подпись есть» — тогда ломается не клиент, а проверка', () => {
    expect(
      buildAuthFailureMessage({
        hostId: 'telegram',
        signaturePresent: true,
        error: '401',
      }),
    ).toContain('подпись есть');
  });

  it('длинный текст ошибки обрезается — в DM не уедет простыня', () => {
    const msg = buildAuthFailureMessage({
      hostId: 'telegram',
      signaturePresent: true,
      error: 'x'.repeat(1000),
    });
    expect(msg.length).toBeLessThan(300);
  });

  it('секция постоянна — по ней отчёты группируются', () => {
    expect(AUTH_FAILURE_SECTION).toBe('auth');
  });
});

describe('useAuthFailureReport', () => {
  it('вход не удался — один отчёт, сколько бы ни было перерендеров', () => {
    const report = vi.fn();
    const input = {
      hostId: 'telegram' as const,
      signaturePresent: false,
      error: '401',
    };
    const { rerender } = renderHook(() => useAuthFailureReport(report, input));
    rerender();
    rerender();

    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][0].section).toBe(AUTH_FAILURE_SECTION);
    expect(report.mock.calls[0][0].message).toContain('подпись ПУСТАЯ');
  });

  it('входу ничего не мешает (null) — отчёта нет', () => {
    const report = vi.fn();
    renderHook(() => useAuthFailureReport(report, null));
    expect(report).not.toHaveBeenCalled();
  });
});
