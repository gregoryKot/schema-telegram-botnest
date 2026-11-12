// Проценты колеса потребностей на схеме случая: оценка выбранного периода
// доходит от источника (ConceptGraphSource.needLinks) до фигуры таблетки, а
// источник без колеса раскладывается ровно как раньше.
import { describe, it, expect } from 'vitest';
import { buildConceptGraph } from '../conceptGraphModel';
import { conceptGraphSource } from '../conceptGraphSource';
import type { ConceptNeedLink } from '../needLinks';
import { RICH, layoutOf, node, source } from './diagram.test-helpers';
import { layoutConceptDiagram } from './diagramLayout';
import {
  defaultNeedPeriod,
  hasNeedRatings,
  needPctTitle,
  rateNeedNodes,
} from './diagramNeedPct';

const WHEEL: ConceptNeedLink[] = [
  {
    needId: 'attachment',
    ratings: { child: 2, teen: 3, now: 5 },
    notes: { now: 'Близкая подруга' },
  },
  { needId: 'autonomy', ratings: { child: 0 }, notes: {} },
  { needId: 'play', ratings: {}, notes: { child: 'Играть запрещали' } },
];

const graph = (needLinks?: ConceptNeedLink[]) =>
  buildConceptGraph(source({ ...RICH, needLinks }), (ty) => ty);

describe('проценты колеса на таблетках потребностей', () => {
  it('оценка выбранного периода доходит до фигуры таблетки; без периода — «Сейчас»', () => {
    const now = layoutConceptDiagram(graph(WHEEL), 1200);
    expect(node(now, 'need:attachment').pct).toBe(50);
    const child = layoutConceptDiagram(graph(WHEEL), 1200, 'child');
    expect(node(child, 'need:attachment').pct).toBe(20);
    expect(node(child, 'need:autonomy').pct).toBe(0);
    const teen = layoutConceptDiagram(graph(WHEEL), 358, 'teen');
    expect(node(teen, 'need:attachment').pct).toBe(30);
  });

  it('потребность без оценки за период — без процента (не ноль), подсказка перечисляет оценённые', () => {
    const now = layoutConceptDiagram(graph(WHEEL), 1200, 'now');
    const autonomy = node(now, 'need:autonomy');
    expect('pct' in autonomy).toBe(false);
    expect(autonomy.title).toBe('Автономия: детство 0%');
    expect(node(now, 'need:attachment').title).toBe(
      'Привязанность: детство 20%, 11–17 лет 30%, сейчас 50%',
    );
  });

  it('потребность без единой оценки (только текст листа или вовсе нет в колесе) — фигура как была', () => {
    const plain = layoutOf(RICH, 1200);
    const rated = layoutConceptDiagram(graph(WHEEL), 1200, 'child');
    for (const id of ['need:play', 'need:expression', 'need:limits']) {
      expect(node(rated, id)).toStrictEqual(node(plain, id));
    }
  });

  it('проценты не двигают раскладку: фигуры на тех же местах, линии те же', () => {
    for (const width of [358, 1200]) {
      const plain = layoutOf(RICH, width);
      const rated = layoutConceptDiagram(graph(WHEEL), width, 'child');
      const box = ({ id, x, y, w, h }: (typeof plain.nodes)[number]) => ({
        id,
        x,
        y,
        w,
        h,
      });
      expect(rated.nodes.map(box)).toEqual(plain.nodes.map(box));
      expect(rated.edges).toEqual(plain.edges);
      expect(rated.height).toBe(plain.height);
    }
  });

  it('источник без колеса, с пустым колесом и с колесом без оценок даёт прежнюю раскладку', () => {
    const plain = layoutOf(RICH, 1200);
    const notesOnly = [WHEEL[2]];
    for (const needLinks of [undefined, [], notesOnly]) {
      expect(layoutConceptDiagram(graph(needLinks), 1200)).toStrictEqual(plain);
    }
    expect(rateNeedNodes(plain.nodes, undefined)).toBe(plain.nodes);
  });
});

describe('колесо в источнике схемы', () => {
  it('conceptGraphSource несёт колесо концептуализации нормализованным, модель — как есть', () => {
    const raw = [
      { needId: 'autonomy', ratings: { now: 7, teen: 11 }, notes: { now: '' } },
      { needId: 'unknown', ratings: { now: 3 }, notes: {} },
    ] as ConceptNeedLink[];
    const src = conceptGraphSource({ needLinks: raw });
    expect(src.needLinks).toEqual([
      { needId: 'autonomy', ratings: { now: 7 }, notes: {} },
    ]);
    expect(buildConceptGraph(src, (ty) => ty).needLinks).toBe(src.needLinks);
  });

  it('концептуализация без колеса (клиентский вид, старый кэш) — пустое колесо, процентов нет', () => {
    const src = conceptGraphSource({ modeIds: ['healthy_adult'] });
    expect(src.needLinks).toEqual([]);
    expect(hasNeedRatings(src.needLinks)).toBe(false);
  });
});

describe('подсказка и период по умолчанию', () => {
  it('подсказка: название и только оценённые периоды в порядке листа; без оценок её нет', () => {
    expect(needPctTitle('Привязанность', WHEEL, 'attachment')).toBe(
      'Привязанность: детство 20%, 11–17 лет 30%, сейчас 50%',
    );
    expect(needPctTitle('Спонтанность', WHEEL, 'play')).toBeUndefined();
    expect(needPctTitle('Границы', undefined, 'limits')).toBeUndefined();
  });

  it('оценки есть — если оценён хоть один период хоть одной потребности', () => {
    expect(hasNeedRatings(WHEEL)).toBe(true);
    expect(hasNeedRatings([WHEEL[2]])).toBe(false);
    expect(hasNeedRatings([])).toBe(false);
    expect(hasNeedRatings(undefined)).toBe(false);
  });

  it('схема открывается на «Сейчас», а без его оценок — на ближайшем оценённом периоде', () => {
    expect(defaultNeedPeriod(WHEEL)).toBe('now');
    expect(defaultNeedPeriod([WHEEL[1]])).toBe('child');
    expect(
      defaultNeedPeriod([
        { needId: 'limits', ratings: { child: 4, teen: 6 }, notes: {} },
      ]),
    ).toBe('teen');
    expect(defaultNeedPeriod(undefined)).toBe('now');
  });
});
