import { describe, it, expect } from 'vitest';
import {
  RICH,
  curvePoints,
  layoutOf,
  mode,
  node,
  rect,
  schema,
} from './diagram.test-helpers';

const kinds = (l: ReturnType<typeof layoutOf>) => l.edges.map((e) => e.kind);
const ids = (l: ReturnType<typeof layoutOf>, kind: string) =>
  l.edges
    .filter((e) => e.kind === kind)
    .map((e) => e.id)
    .sort();

describe('рёбра: только из данных', () => {
  it('критик и ребёнок без связей — ни одной линии между ними и вообще ни одной', () => {
    for (const w of [390, 1200]) {
      const l = layoutOf(
        { modeIds: ['punitive_critic', 'vulnerable_child'] },
        w,
      );
      expect(l.edges).toEqual([]);
    }
  });

  it('виды линий — только link, origin, blocks, meets; никаких «давит», «цена», «запускает»', () => {
    for (const w of [390, 1200]) {
      const l = layoutOf(RICH, w);
      expect(new Set(kinds(l))).toEqual(
        new Set(['link', 'origin', 'blocks', 'meets']),
      );
      expect(l.edges.map((e) => e.id).join(' ')).not.toMatch(
        /presses|cost|triggers|protects/,
      );
    }
  });

  it('режим ⇄ схема: по линии на каждую схему из связи режима, стрелки с обеих сторон', () => {
    const l = layoutOf(RICH, 1200);
    expect(ids(l, 'link')).toEqual([
      'link:mode:detached_protector>schema:emotional_inhibition',
      'link:mode:guilt_critic>schema:emotional_deprivation',
      'link:mode:punitive_critic>schema:emotional_deprivation',
      'link:mode:punitive_critic>schema:emotional_inhibition',
    ]);
    expect(l.edges.filter((e) => e.kind === 'link').every((e) => e.both)).toBe(
      true,
    );
    expect(l.edges.filter((e) => e.kind !== 'link').some((e) => e.both)).toBe(
      false,
    );
  });

  it('связь здорового режима со схемой линии не даёт; связь режима не с карты — тоже', () => {
    const l = layoutOf(
      {
        modeIds: ['healthy_adult'],
        schemaIds: ['failure'],
        modeLinks: [
          mode('healthy_adult', { schemaIds: ['failure'] }),
          mode('punitive_critic', { schemaIds: ['failure'] }),
        ],
      },
      1200,
    );
    expect(ids(l, 'link')).toEqual([]);
  });

  it('✗ blocks: схема → таблетка для каждого needId схемы, и только для них', () => {
    const l = layoutOf(RICH, 1200);
    expect(ids(l, 'blocks')).toEqual([
      'blocks:schema:emotional_deprivation>need:attachment',
      'blocks:schema:emotional_deprivation>need:expression',
      'blocks:schema:emotional_inhibition>need:expression',
      'blocks:schema:emotional_inhibition>need:limits',
    ]);
  });

  it('✓ meets: здоровый режим → таблетка для его needIds; needIds остальных режимов линий не дают', () => {
    const l = layoutOf(
      {
        ...RICH,
        modeLinks: [
          ...RICH.modeLinks!,
          mode('vulnerable_child', { needIds: ['limits'] }),
        ],
      },
      1200,
    );
    expect(ids(l, 'meets')).toEqual([
      'meets:mode:healthy_adult>need:attachment',
      'meets:mode:healthy_adult>need:autonomy',
      'meets:mode:healthy_adult>need:play',
    ]);
  });

  it('овал опыта и его стрелка — только при непустом опыте', () => {
    const l = layoutOf(
      {
        schemaIds: ['failure', 'mistrust'],
        schemaLinks: [
          schema('failure', { origin: 'строгий отец' }),
          schema('mistrust', { belief: 'мне нельзя верить' }),
        ],
      },
      1200,
    );
    expect(l.nodes.some((n) => n.id === 'origin:failure')).toBe(true);
    expect(l.nodes.some((n) => n.id === 'origin:mistrust')).toBe(false);
    expect(ids(l, 'origin')).toEqual(['origin:origin:failure>schema:failure']);
  });

  it('потребность, которой нет ни у одной схемы, остаётся без линий', () => {
    const l = layoutOf(RICH, 1200);
    expect(
      l.edges.some((e) => e.to === 'need:attachment' && e.kind === 'blocks'),
    ).toBe(true);
    expect(
      l.edges.some(
        (e) =>
          e.from === 'need:play' ||
          (e.to === 'need:play' && e.kind === 'blocks'),
      ),
    ).toBe(false);
  });
});

describe('рёбра: значки ✗ и ✓', () => {
  it('значок только у blocks (✗) и meets (✓), по одному на линию', () => {
    for (const w of [390, 1200]) {
      const l = layoutOf(RICH, w);
      for (const e of l.edges) {
        if (e.kind === 'blocks') expect(e.badge?.kind).toBe('block');
        else if (e.kind === 'meets') expect(e.badge?.kind).toBe('meet');
        else expect(e.badge).toBeUndefined();
      }
    }
  });

  it('значок не лежит под фигурой', () => {
    for (const w of [390, 1200]) {
      const l = layoutOf(RICH, w);
      for (const e of l.edges.filter((x) => x.badge)) {
        const { at } = e.badge!;
        for (const n of l.nodes) {
          const r = rect(n);
          const under =
            at.x > r.x && at.x < r.x + r.w && at.y > r.y && at.y < r.y + r.h;
          expect(under, `${e.id} под ${n.id} на ${w}`).toBe(false);
        }
      }
    }
  });
});

describe('рёбра: стиль', () => {
  it('✗ красная линия около 70%, ✓ зелёная, связь режим ⇄ схема серая', () => {
    const l = layoutOf(RICH, 1200);
    const block = l.edges.find((e) => e.kind === 'blocks')!;
    expect(block.color).toBe('var(--accent-red)');
    expect(block.opacity).toBeCloseTo(0.7, 1);
    expect(l.edges.find((e) => e.kind === 'meets')!.color).toBe(
      'var(--accent-green)',
    );
    expect(l.edges.find((e) => e.kind === 'link')!.color).toBe(
      'var(--text-sub)',
    );
  });
});

describe('рёбра: линии огибают чужие фигуры', () => {
  it('ни одна линия не проходит сквозь фигуру, кроме своих концов (оба вида, богатый случай)', () => {
    for (const w of [390, 600, 960, 1200, 1600]) {
      const l = layoutOf(
        {
          ...RICH,
          modeIds: [
            ...RICH.modeIds!,
            'angry_child',
            'overcontroller',
            'happy_child',
          ],
          modeLinks: [
            ...RICH.modeLinks!,
            mode('overcontroller', { schemaIds: ['emotional_inhibition'] }),
            mode('happy_child', { needIds: ['expression', 'limits'] }),
          ],
        },
        w,
      );
      for (const e of l.edges) {
        for (const n of l.nodes) {
          if (n.id === e.from || n.id === e.to) continue;
          const r = rect(n);
          const hit = curvePoints(e.points).find(
            (p) =>
              p.x > r.x + 2 &&
              p.x < r.x + r.w - 2 &&
              p.y > r.y + 2 &&
              p.y < r.y + r.h - 2,
          );
          expect(hit, `${e.id} задевает ${n.id} на ${w}`).toBeUndefined();
        }
      }
    }
  });

  it('линия начинается и заканчивается на рамке своих фигур', () => {
    const l = layoutOf(RICH, 1200);
    for (const e of l.edges) {
      const [a, b] = [e.points[0], e.points[e.points.length - 1]];
      for (const [p, id] of [
        [a, e.from],
        [b, e.to],
      ] as const) {
        const r = rect(node(l, id));
        expect(p.x).toBeGreaterThanOrEqual(r.x - 0.5);
        expect(p.x).toBeLessThanOrEqual(r.x + r.w + 0.5);
        expect(p.y).toBeGreaterThanOrEqual(r.y - 0.5);
        expect(p.y).toBeLessThanOrEqual(r.y + r.h + 0.5);
      }
    }
  });
});

describe('рёбра: вид', () => {
  it('узкий вид: ✗ входит в таблетку сбоку, с левой дорожки; ✓ — с правой', () => {
    const l = layoutOf(RICH, 390);
    const pill = node(l, 'need:expression');
    const block = l.edges.find(
      (x) => x.id === 'blocks:schema:emotional_deprivation>need:expression',
    )!;
    const end = block.points[block.points.length - 1];
    expect(Math.abs(end.x - pill.x)).toBeLessThan(2);
    expect(Math.abs(end.y - (pill.y + pill.h / 2))).toBeLessThan(pill.h / 2);
    // дорожка слева: линия уходит к левому краю, за круг
    expect(Math.min(...block.points.map((p) => p.x))).toBeLessThan(
      l.circle.cx - l.circle.r,
    );

    const meet = l.edges.find(
      (x) => x.id === 'meets:mode:healthy_adult>need:autonomy',
    )!;
    const meetEnd = meet.points[meet.points.length - 1];
    const auto = node(l, 'need:autonomy');
    expect(Math.abs(meetEnd.x - (auto.x + auto.w))).toBeLessThan(2);
    expect(Math.max(...meet.points.map((p) => p.x))).toBeGreaterThan(
      l.circle.cx + l.circle.r,
    );
  });

  it('широкий вид: ✗ идёт слева направо к кругу, ✓ — справа налево', () => {
    const l = layoutOf(RICH, 1200);
    const block = l.edges.find((x) => x.kind === 'blocks')!;
    expect(block.points[0].x).toBeLessThan(
      block.points[block.points.length - 1].x,
    );
    const meet = l.edges.find((x) => x.kind === 'meets')!;
    expect(meet.points[0].x).toBeGreaterThan(
      meet.points[meet.points.length - 1].x,
    );
  });

  it('дальняя таблетка колонки входит по просвету между рядами: снизу у верхнего ряда, сверху у нижнего', () => {
    const l = layoutOf(
      {
        schemaIds: ['failure'],
        schemaLinks: [schema('failure', { needIds: ['autonomy', 'limits'] })],
      },
      1200,
    );
    for (const [id, side] of [
      ['autonomy', 'bottom'],
      ['limits', 'top'],
    ] as const) {
      const e = l.edges.find((x) => x.to === `need:${id}`)!;
      const end = e.points[e.points.length - 1];
      const pill = node(l, `need:${id}`);
      const edgeY = side === 'bottom' ? pill.y + pill.h : pill.y;
      expect(Math.abs(end.y - edgeY)).toBeLessThan(2);
    }
  });
});
