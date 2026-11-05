// Сводка «Коротко» (#902): строки из модели схемы случая — порядок, пустые
// строки, формат режимов и потребностей, обрезка цели по слову.
import { describe, it, expect } from 'vitest';
import { buildConceptGraph } from './conceptGraphModel';
import type { ConceptGraphSource } from './conceptGraphTypes';
import { emptyModeLink } from './modeLinks';
import { emptySchemaLink } from './schemaLinks';
import {
  CYCLE_CLIP,
  GOAL_CLIP,
  buildConceptDigest,
  clip,
  type DigestKey,
  type DigestRow,
} from './conceptDigestModel';

const ty = (a: string) => a;

const digest = (
  patch: Partial<ConceptGraphSource>,
  goals?: string | null,
): DigestRow[] =>
  buildConceptDigest(
    buildConceptGraph(
      { modeIds: [], schemaIds: [], modeLinks: [], schemaLinks: [], ...patch },
      ty,
    ),
    goals,
  );

const text = (rows: DigestRow[], key: DigestKey) =>
  rows.find((r) => r.key === key)?.text;

const RICH: Partial<ConceptGraphSource> = {
  schemaIds: ['failure', 'abandonment'],
  modeIds: [
    'healthy_adult',
    'detached_protector',
    'punitive_critic',
    'vulnerable_child',
  ],
  modeLinks: [
    { ...emptyModeLink('punitive_critic'), alias: 'Судья' },
    { ...emptyModeLink('healthy_adult'), needIds: ['limits', 'attachment'] },
  ],
  schemaLinks: [
    { ...emptySchemaLink('failure'), needIds: ['autonomy'] },
    { ...emptySchemaLink('abandonment'), needIds: ['attachment'] },
  ],
  modeTransitions: '  Критика → Судья → уход в себя  ',
};

describe('buildConceptDigest', () => {
  it('богатая модель — пять строк в порядке схемы → режимы → цикл → потребности → цель', () => {
    const rows = digest(RICH, 'Снизить тревогу');
    expect(rows.map((r) => [r.key, r.label])).toEqual([
      ['schemas', 'Схемы'],
      ['modes', 'Режимы'],
      ['cycle', 'Цикл'],
      ['needs', 'Потребности'],
      ['goal', 'Цель'],
    ]);
    // схемы — в порядке доменов, не порядке клика
    expect(text(rows, 'schemas')).toBe(
      'Покинутость / Нестабильность · Неуспешность',
    );
    // полосы: детские → критикующие → копинг, здоровые после « → »
    expect(text(rows, 'modes')).toBe(
      'Уязвимый Ребёнок · Судья (Карающий Критик) · Отстранённый Защитник → Здоровый Взрослый',
    );
    expect(text(rows, 'cycle')).toBe('Критика → Судья → уход в себя');
    // объединение по схемам и по здоровым режимам, порядок NEED_ORDER
    expect(text(rows, 'needs')).toBe(
      '✗ блокированы: Привязанность · Автономия · ✓ есть опора: Привязанность · Границы',
    );
    expect(text(rows, 'goal')).toBe('Снизить тревогу');
  });

  it('пустая модель — [] (карточки не будет)', () => {
    expect(digest({})).toEqual([]);
    expect(digest({}, '   ')).toEqual([]);
    expect(digest({ modeTransitions: ' \n ' }, null)).toEqual([]);
  });

  it('режим без alias — только название; с alias — слова клиента и название в скобках', () => {
    const rows = digest({
      modeIds: ['punitive_critic', 'vulnerable_child'],
      modeLinks: [{ ...emptyModeLink('vulnerable_child'), alias: 'Малыш' }],
    });
    expect(text(rows, 'modes')).toBe(
      'Малыш (Уязвимый Ребёнок) · Карающий Критик',
    );
    expect(rows.map((r) => r.key)).toEqual(['modes']);
  });

  it('без здоровых режимов стрелки нет; только здоровые — без стрелки тоже', () => {
    expect(
      text(
        digest({ modeIds: ['punitive_critic', 'detached_protector'] }),
        'modes',
      ),
    ).toBe('Карающий Критик · Отстранённый Защитник');
    expect(text(digest({ modeIds: ['healthy_adult'] }), 'modes')).toBe(
      'Здоровый Взрослый',
    );
  });

  it('цикл длиннее CYCLE_CLIP режется по слову с «…», короткий — как есть', () => {
    const long = Array.from({ length: 60 }, (_, i) => `шаг${i}`).join(' → ');
    const cycle =
      text(digest({ ...RICH, modeTransitions: long }, null), 'cycle') ?? '';
    expect(cycle.endsWith('…')).toBe(true);
    expect(cycle.length).toBeLessThanOrEqual(CYCLE_CLIP + 1);
    expect(cycle).not.toContain('шаг59');
    expect(text(digest(RICH, null), 'cycle')).toBe(
      'Критика → Судья → уход в себя',
    );
  });

  it('потребности: только блокируемые → одна часть «✗», только здоровые → одна часть «✓»', () => {
    const blockedOnly = digest({
      schemaIds: ['failure'],
      schemaLinks: [
        { ...emptySchemaLink('failure'), needIds: ['limits', 'play'] },
      ],
    });
    expect(text(blockedOnly, 'needs')).toBe(
      '✗ блокированы: Спонтанность · Границы',
    );

    const metOnly = digest({
      modeIds: ['healthy_adult'],
      modeLinks: [
        { ...emptyModeLink('healthy_adult'), needIds: ['expression'] },
      ],
    });
    expect(text(metOnly, 'needs')).toBe('✓ есть опора: Выражение чувств');

    // схема есть, но потребности не отмечены — строки нет
    expect(text(digest({ schemaIds: ['failure'] }), 'needs')).toBeUndefined();
  });

  it('цель: ровно в предел — как есть; длиннее — по слову с «…»; переносы схлопываются', () => {
    const exact = `${'а'.repeat(79)} ${'б'.repeat(80)}`;
    expect(exact).toHaveLength(GOAL_CLIP);
    expect(text(digest({ schemaIds: ['failure'] }, exact), 'goal')).toBe(exact);

    const longer = `${'а'.repeat(79)} ${'б'.repeat(81)}`;
    expect(text(digest({}, longer), 'goal')).toBe(`${'а'.repeat(79)}…`);

    expect(text(digest({}, 'Снизить\n\nтревогу '), 'goal')).toBe(
      'Снизить тревогу',
    );
  });
});

describe('clip', () => {
  it('граница слова ровно на пределе — слово остаётся целиком', () => {
    expect(clip(`${'а'.repeat(160)} б`, 160)).toBe(`${'а'.repeat(160)}…`);
  });

  it('слово длиннее предела режется по пределу', () => {
    expect(clip('а'.repeat(170), 160)).toBe(`${'а'.repeat(160)}…`);
  });

  it('запятая или тире перед обрезом не остаются перед «…»', () => {
    expect(clip('Снизить тревогу, вернуть злость', 16)).toBe(
      'Снизить тревогу…',
    );
    expect(clip('Снизить тревогу — вернуть злость', 18)).toBe(
      'Снизить тревогу…',
    );
  });
});
