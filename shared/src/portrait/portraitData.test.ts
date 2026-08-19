// Тесты чистого слоя данных «Моего портрета»: пустые входы не должны падать
// или показывать мусор (правило CLAUDE.md «хардкод-заглушки» — на чистом
// аккаунте только нули/пусто), активные схемы с бэка и ручного выбора не
// должны задваиваться при пересечении, дельта считается только при ≥2
// записей истории (history[0] — самая свежая, см. ysq.service.ts orderBy desc).
import { describe, it, expect } from 'vitest';
import {
  buildPortrait,
  hasPortraitData,
  type PortraitInput,
} from './portraitData';
import type { YsqHistoryEntry } from '../hooks/ysqScoring';

const empty: PortraitInput = {
  activeSchemaIds: [],
  manualSchemaIds: [],
  myModeIds: [],
  ysqHistory: [],
};

const historyEntry = (id: number, activeCount: number): YsqHistoryEntry => ({
  id,
  completedAt: '2026-08-01T00:00:00.000Z',
  scores: Array.from({ length: activeCount }, (_, i) => ({
    id: `schema_${i}`,
    pct5plus: 100,
    avg: 6,
  })),
});

describe('buildPortrait — пустые входы', () => {
  it('нет активных схем, нет ручного выбора, нет режимов, нет истории → всё пусто/ноль', () => {
    const p = buildPortrait(empty);
    expect(p.totalSchemas).toBe(0);
    expect(p.totalModes).toBe(0);
    expect(p.delta).toBeNull();
    expect(p.domains).toHaveLength(5);
    expect(p.domains.every((d) => d.count === 0)).toBe(true);
    expect(hasPortraitData(p)).toBe(false);
  });
});

describe('buildPortrait — активные схемы', () => {
  it('активная схема с бэка попадает в свой домен', () => {
    // emotional_deprivation — домен rejection (см. schemaDomains.ts).
    const p = buildPortrait({
      ...empty,
      activeSchemaIds: ['emotional_deprivation'],
    });
    const rejection = p.domains.find((d) => d.id === 'rejection')!;
    expect(rejection.count).toBe(1);
    expect(p.totalSchemas).toBe(1);
    expect(hasPortraitData(p)).toBe(true);
  });

  it('пересечение активной с бэка и той же ручной схемы не задваивается', () => {
    const p = buildPortrait({
      ...empty,
      activeSchemaIds: ['emotional_deprivation'],
      manualSchemaIds: ['emotional_deprivation'],
    });
    const rejection = p.domains.find((d) => d.id === 'rejection')!;
    expect(rejection.count).toBe(1);
    expect(p.totalSchemas).toBe(1);
  });

  it('ручной выбор без активных с бэка считается сам по себе (manual-only)', () => {
    // dependence — домен autonomy.
    const p = buildPortrait({ ...empty, manualSchemaIds: ['dependence'] });
    const autonomy = p.domains.find((d) => d.id === 'autonomy')!;
    expect(autonomy.count).toBe(1);
    expect(p.totalSchemas).toBe(1);
  });

  it('неизвестный id не роняет расчёт и не считается ни там, ни там', () => {
    const p = buildPortrait({
      ...empty,
      activeSchemaIds: ['несуществующая_схема'],
      manualSchemaIds: ['ещё_несуществующая'],
    });
    expect(p.totalSchemas).toBe(0);
  });

  it('totalModes = длина myModeIds', () => {
    const p = buildPortrait({ ...empty, myModeIds: ['mode_a', 'mode_b'] });
    expect(p.totalModes).toBe(2);
  });
});

describe('buildPortrait — дельта по истории YSQ', () => {
  it('0 записей истории → delta null', () => {
    expect(buildPortrait(empty).delta).toBeNull();
  });

  it('1 запись истории → delta null (не с чем сравнивать)', () => {
    const p = buildPortrait({ ...empty, ysqHistory: [historyEntry(1, 3)] });
    expect(p.delta).toBeNull();
  });

  it('2 записи истории → delta = актив(последней) - актив(предыдущей)', () => {
    const p = buildPortrait({
      ...empty,
      ysqHistory: [historyEntry(2, 5), historyEntry(1, 3)],
    });
    expect(p.delta).toBe(2);
  });

  it('дельта может быть отрицательной (прогресс — схем стало меньше)', () => {
    const p = buildPortrait({
      ...empty,
      ysqHistory: [historyEntry(2, 1), historyEntry(1, 4)],
    });
    expect(p.delta).toBe(-3);
  });
});
