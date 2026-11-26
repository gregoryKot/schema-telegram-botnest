// Воронка теста схем в /stats (находка аудита 2026-10-11: «Начали: 1 · дошли
// до конца: 3 (300%)» — «начали» считались по YsqProgress, который клиент
// удаляет при завершении). Здесь — разбор ответа и строка отчёта; сам SQL
// исполняется на живом Postgres в test/raw-sql-live-stats.e2e-spec.ts: мок
// $queryRaw ниже проверяет только разбор результата, не запрос (правило №18).
import { countYsqFunnel, ysqFunnelLine } from './ysq-funnel-metrics';

describe('ysqFunnelLine', () => {
  it('дошедших больше, чем начавших — «данные не сходятся», без процента', () => {
    const line = ysqFunnelLine({ started: 1, completed: 3 });
    expect(line).toBe('Начали: 1 · дошли до конца: 3 — данные не сходятся');
    expect(line).not.toContain('300%');
    expect(line).not.toMatch(/%/);
  });

  it('пустая база — словами, без 0%/NaN', () => {
    const line = ysqFunnelLine({ started: 0, completed: 0 });
    expect(line).toBe('Пока тест никто не начинал');
  });

  it('начали, но никто не дошёл — 0%, а не пустота', () => {
    expect(ysqFunnelLine({ started: 4, completed: 0 })).toBe(
      'Начали: 4 · дошли до конца: 0 (0%)',
    );
  });

  it('обычная воронка — процент дошедших', () => {
    expect(ysqFunnelLine({ started: 4, completed: 3 })).toBe(
      'Начали: 4 · дошли до конца: 3 (75%)',
    );
    expect(ysqFunnelLine({ started: 3, completed: 3 })).toBe(
      'Начали: 3 · дошли до конца: 3 (100%)',
    );
  });

  it('дошли без «начали» (0 при completed > 0) — тоже расхождение, не деление на ноль', () => {
    const line = ysqFunnelLine({ started: 0, completed: 2 });
    expect(line).toContain('данные не сходятся');
    expect(line).not.toMatch(/NaN|Infinity|%/);
  });
});

describe('countYsqFunnel', () => {
  it('bigint из ответа → number', async () => {
    const prisma = {
      $queryRaw: jest.fn(async () => [{ started: 5n, completed: 3n }]),
    };
    await expect(countYsqFunnel(prisma as never)).resolves.toEqual({
      started: 5,
      completed: 3,
    });
  });

  it('пустой ответ — нули', async () => {
    const prisma = { $queryRaw: jest.fn(async () => []) };
    await expect(countYsqFunnel(prisma as never)).resolves.toEqual({
      started: 0,
      completed: 0,
    });
  });
});
