// Тесты чистого слоя данных «Моего портрета»: пустые входы не должны падать
// или показывать мусор (правило CLAUDE.md «хардкод-заглушки» — на чистом
// аккаунте только нули/пусто), активные схемы с бэка и ручного выбора не
// должны задваиваться при пересечении, дельта считается только при ≥2
// записей истории (history[0] — самая свежая, см. ysq.service.ts orderBy desc).
// Группировка — по пяти базовым потребностям (не по клиническим доменам
// схема-терапии, см. комментарий в portraitData.ts).
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
    expect(p.needs).toHaveLength(5);
    expect(p.needs.every((n) => n.count === 0)).toBe(true);
    expect(hasPortraitData(p)).toBe(false);
  });

  it('все поля не заданы (профиль ещё грузится частями) → тот же пустой результат, не падает', () => {
    const p = buildPortrait({});
    expect(p.totalSchemas).toBe(0);
    expect(p.totalModes).toBe(0);
    expect(p.delta).toBeNull();
    expect(p.needs.every((n) => n.count === 0)).toBe(true);
  });
});

describe('buildPortrait — потребности: порядок, подписи, эмодзи, цвет', () => {
  it('пять потребностей в порядке NEED_ORDER с подписью, эмодзи и цветом', () => {
    const p = buildPortrait(empty);
    expect(p.needs.map((n) => n.id)).toEqual([
      'attachment',
      'autonomy',
      'expression',
      'play',
      'limits',
    ]);
    const attachment = p.needs.find((n) => n.id === 'attachment')!;
    expect(attachment.label).toBe('Привязанность');
    expect(attachment.emoji).toBe('🤝');
    expect(attachment.color).toBe('#ff6b9d');
  });

  it('у каждой из пяти потребностей есть непустая подпись и эмодзи — реестры не разъехались', () => {
    const p = buildPortrait(empty);
    for (const n of p.needs) {
      expect(n.label).toBeTruthy();
      expect(n.emoji).toBeTruthy();
      expect(n.color).toBeTruthy();
    }
  });
});

describe('buildPortrait — активные схемы', () => {
  it('активная схема с бэка попадает в свою потребность', () => {
    // emotional_deprivation — потребность attachment (см. ysqSchemasContent.ts).
    const p = buildPortrait({
      ...empty,
      activeSchemaIds: ['emotional_deprivation'],
    });
    const attachment = p.needs.find((n) => n.id === 'attachment')!;
    expect(attachment.count).toBe(1);
    expect(p.totalSchemas).toBe(1);
    expect(hasPortraitData(p)).toBe(true);
  });

  it('пересечение активной с бэка и той же ручной схемы не задваивается', () => {
    const p = buildPortrait({
      ...empty,
      activeSchemaIds: ['emotional_deprivation'],
      manualSchemaIds: ['emotional_deprivation'],
    });
    const attachment = p.needs.find((n) => n.id === 'attachment')!;
    expect(attachment.count).toBe(1);
    expect(p.totalSchemas).toBe(1);
  });

  it('ручной выбор без активных с бэка считается сам по себе (manual-only)', () => {
    // failure — потребность autonomy.
    const p = buildPortrait({ ...empty, manualSchemaIds: ['failure'] });
    const autonomy = p.needs.find((n) => n.id === 'autonomy')!;
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
