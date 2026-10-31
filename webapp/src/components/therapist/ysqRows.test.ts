import { describe, it, expect } from 'vitest';
import { buildYsqRows, fmtDelta, deltaClass } from './ysqRows';

type S = { id: string; pct5plus: number; avg?: number; active?: boolean };
const run = (scores: S[]) => ({ id: 1, completedAt: '2026-10-01T10:00:00Z', scores });

describe('buildYsqRows', () => {
  // QA 2026-10-26: клиент видел «Самопожертвование 4/6» среди выраженных, а
  // терапевт в таблице — серые 0% (таблица смотрела только на долю «5–6»).
  it('схема, выраженная по среднему баллу, — вверху и с отметкой, хотя «5–6» = 0%', () => {
    const rows = buildYsqRows(run([
      { id: 'mistrust', pct5plus: 40, avg: 3.6, active: false },
      { id: 'self_sacrifice', pct5plus: 0, avg: 4, active: true },
      { id: 'abandonment', pct5plus: 100, avg: 6, active: true },
    ]), null);
    expect(rows.map(r => [r.id, r.active])).toEqual([
      ['abandonment', true], ['self_sacrifice', true], ['mistrust', false],
    ]);
    expect(rows[1]).toMatchObject({ pct: 0, avg: 4, avgLabel: '4/6', barPct: 60 });
  });

  it('флаг бэкенда главнее: невыраженная схема не поднимается над выраженной', () => {
    const rows = buildYsqRows(run([
      { id: 'mistrust', pct5plus: 50, avg: 3.9, active: false },
      { id: 'failure', pct5plus: 60, avg: 3.8, active: true },
    ]), null);
    expect(rows.map(r => r.id)).toEqual(['failure', 'mistrust']);
  });

  it('ответ без флага (кэш прошлой версии) — тот же критерий, не «всё серое»', () => {
    const rows = buildYsqRows(run([{ id: 'self_sacrifice', pct5plus: 0, avg: 4 }]), null);
    expect(rows[0].active).toBe(true);
  });

  it('Δ — по среднему баллу к прошлому прохождению; без прошлого или без балла — нет', () => {
    const rows = buildYsqRows(
      run([{ id: 'failure', pct5plus: 60, avg: 4.4, active: true }, { id: 'mistrust', pct5plus: 0, avg: 2, active: false }]),
      run([{ id: 'failure', pct5plus: 40, avg: 4, active: true }, { id: 'mistrust', pct5plus: 0 }]),
    );
    expect(rows[0]).toMatchObject({ delta: 0.4, prevBarPct: 60 });
    expect(rows[1]).toMatchObject({ delta: null, prevBarPct: null });
    expect(buildYsqRows(run([{ id: 'failure', pct5plus: 60, avg: 4 }]), null)[0].delta).toBeNull();
  });

  it('нет ответов — «–», а не «0/6»', () => {
    expect(buildYsqRows(run([{ id: 'failure', pct5plus: 0, avg: 0 }]), null)[0].avgLabel).toBe('–');
  });
});

describe('fmtDelta / deltaClass', () => {
  it('формат и класс', () => {
    expect(fmtDelta(0.4)).toBe('+0.4');
    expect(fmtDelta(-3)).toBe('-3');
    expect(fmtDelta(0)).toBe('0');
    expect(fmtDelta(null)).toBe('–');
    expect(deltaClass(-1)).toBe('is-down');
    expect(deltaClass(1)).toBe('is-up');
    expect(deltaClass(0)).toBe('is-zero');
    expect(deltaClass(null)).toBe('is-zero');
  });
});
