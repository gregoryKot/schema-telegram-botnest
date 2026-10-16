import { describe, it, expect } from 'vitest';
import { NEED_ORDER } from '../../../needs/needData';
import {
  RICH,
  bySection,
  layoutOf,
  mode,
  node,
  overlap,
  rect,
  schema,
} from './diagram.test-helpers';
import { MIN_WIDTH } from './diagramLayout';
import { WIDE_MIN } from './diagramTypes';

const minX = (ns: { x: number }[]) => Math.min(...ns.map((n) => n.x));
const maxX = (ns: { x: number; w: number }[]) =>
  Math.max(...ns.map((n) => n.x + n.w));
const minY = (ns: { y: number }[]) => Math.min(...ns.map((n) => n.y));
const maxY = (ns: { y: number; h: number }[]) =>
  Math.max(...ns.map((n) => n.y + n.h));

describe('раскладка: порядок секций', () => {
  it('широкий вид: слева направо режимы, схемы, круг потребностей, здоровые режимы', () => {
    const l = layoutOf(RICH, 1200);
    expect(l.wide).toBe(true);
    const modes = bySection(l, 'modes');
    const schemas = bySection(l, 'schemas');
    const needs = bySection(l, 'needs');
    const healthy = bySection(l, 'healthy');
    expect(maxX(modes)).toBeLessThan(minX(schemas));
    expect(maxX(schemas)).toBeLessThan(l.circle.cx - l.circle.r);
    expect(l.circle.cx + l.circle.r).toBeLessThan(minX(healthy));
    expect(needs.every((n) => n.x > l.circle.cx - l.circle.r)).toBe(true);
  });

  it('широкий вид: колонки центрированы по вертикали относительно круга', () => {
    const l = layoutOf(RICH, 1200);
    const mid = (ns: { y: number; h: number }[]) => (minY(ns) + maxY(ns)) / 2;
    expect(mid(bySection(l, 'healthy'))).toBeCloseTo(l.circle.cy, 0);
    expect(mid(bySection(l, 'schemas'))).toBeCloseTo(l.circle.cy, 0);
  });

  it('узкий вид: сверху вниз режимы, схемы, круг, здоровые режимы', () => {
    const l = layoutOf(RICH, 390);
    expect(l.wide).toBe(false);
    expect(maxY(bySection(l, 'modes'))).toBeLessThan(
      minY(bySection(l, 'schemas')),
    );
    expect(maxY(bySection(l, 'schemas'))).toBeLessThan(
      l.circle.cy - l.circle.r,
    );
    expect(l.circle.cy + l.circle.r).toBeLessThan(
      minY(bySection(l, 'healthy')),
    );
  });

  it('граница вида — WIDE_MIN: на 960 колонки, на 959 одна колонка', () => {
    expect(layoutOf(RICH, WIDE_MIN).wide).toBe(true);
    expect(layoutOf(RICH, WIDE_MIN - 1).wide).toBe(false);
  });

  it('у каждой секции с кнопкой свой заголовок и своя подпись добавления', () => {
    for (const w of [1200, 390]) {
      const l = layoutOf({}, w);
      expect(l.sections.map((s) => [s.id, s.title, s.add])).toEqual([
        ['modes', 'Режимы', '+ режим'],
        ['schemas', 'Схемы', '+ схема'],
        ['healthy', 'Здоровые режимы', '+ режим'],
      ]);
    }
  });
});

describe('раскладка: круг потребностей', () => {
  it('круг и пять таблеток рисуются всегда, даже на пустой концептуализации', () => {
    for (const w of [390, 1200]) {
      const l = layoutOf({}, w);
      expect(l.circle.title).toBe('Базовые эмоциональные потребности');
      expect(bySection(l, 'needs').map((n) => n.needId)).toEqual([
        ...NEED_ORDER,
      ]);
      expect(l.edges).toEqual([]);
    }
  });

  it('таблетки идут 2–1–2 и целиком лежат внутри круга на любой ширине', () => {
    for (const w of [320, 360, 390, 700, 959, 960, 1100, 1600]) {
      const l = layoutOf({}, w);
      const rows = bySection(l, 'needs').map((n) => n.y);
      expect(rows[0]).toBe(rows[1]);
      expect(rows[3]).toBe(rows[4]);
      expect(rows[0]).toBeLessThan(rows[2]);
      expect(rows[2]).toBeLessThan(rows[3]);
      for (const n of bySection(l, 'needs')) {
        for (const [px, py] of [
          [n.x, n.y],
          [n.x + n.w, n.y],
          [n.x, n.y + n.h],
          [n.x + n.w, n.y + n.h],
        ]) {
          expect(Math.hypot(px - l.circle.cx, py - l.circle.cy)).toBeLessThan(
            l.circle.r - 4,
          );
        }
      }
    }
  });

  it('диаметр: узкий вид — не больше 320 и не шире экрана; широкий — от 288 до 340', () => {
    expect(layoutOf({}, 390).circle.r * 2).toBe(320);
    expect(layoutOf({}, 330).circle.r * 2).toBe(330 - 32);
    expect(layoutOf({}, 700).circle.r * 2).toBe(320);
    const wide = layoutOf({}, 1400).circle.r * 2;
    expect(wide).toBe(340);
    expect(layoutOf({}, WIDE_MIN).circle.r * 2).toBeGreaterThanOrEqual(288);
  });
});

describe('раскладка: геометрия', () => {
  it('фигуры не перекрываются друг с другом на всех ширинах', () => {
    for (const w of [320, 390, 700, 960, 1200, 1600]) {
      const nodes = layoutOf(RICH, w).nodes;
      nodes.forEach((a, i) =>
        nodes.slice(i + 1).forEach((b) => {
          expect(overlap(rect(a), rect(b)), `${a.id} и ${b.id} на ${w}`).toBe(
            false,
          );
        }),
      );
    }
  });

  it('узкий вид не даёт горизонтального скролла: фигуры, линии и круг внутри ширины', () => {
    for (const w of [320, 360, 390, 600, 959]) {
      const l = layoutOf(RICH, w);
      expect(l.width).toBe(w);
      for (const n of l.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x + n.w).toBeLessThanOrEqual(w);
      }
      expect(l.circle.cx - l.circle.r).toBeGreaterThanOrEqual(0);
      expect(l.circle.cx + l.circle.r).toBeLessThanOrEqual(w);
      for (const e of l.edges) {
        for (const p of e.points) {
          expect(p.x).toBeGreaterThanOrEqual(-0.5);
          expect(p.x).toBeLessThanOrEqual(w + 0.5);
        }
      }
    }
  });

  it('контейнер уже минимума раскладывается как минимум, а не ломает фигуры', () => {
    expect(layoutOf(RICH, 200).width).toBe(MIN_WIDTH);
  });

  it('широкий вид помещается и в 960, и в 1600', () => {
    for (const w of [960, 1000, 1280, 1600]) {
      const l = layoutOf(RICH, w);
      expect(minX(l.nodes)).toBeGreaterThanOrEqual(0);
      expect(maxX(l.nodes)).toBeLessThanOrEqual(w);
    }
  });

  it('высота растёт вместе с текстом режима и фигура вмещает его строки', () => {
    const h = (manifest: string) =>
      node(
        layoutOf(
          {
            modeIds: ['punitive_critic'],
            modeLinks: [mode('punitive_critic', { manifest })],
          },
          1200,
        ),
        'mode:punitive_critic',
      );
    const short = h('Коротко');
    const long = h('Очень длинная реплика критика '.repeat(8));
    const huge = h('Очень длинная реплика критика '.repeat(80));
    expect(long.h).toBeGreaterThan(short.h);
    expect(huge.h).toBeGreaterThanOrEqual(long.h);
    expect(huge.bodyLines).toBe(6);
    expect(huge.h).toBe(h('Очень длинная реплика критика '.repeat(200)).h);
  });

  it('здоровый режим крупнее и вмещает до 8 строк, схема — до 7, овал опыта — до 5', () => {
    const l = layoutOf(RICH, 1200);
    expect(node(l, 'mode:healthy_adult').bodyLines).toBe(8);
    expect(node(l, 'mode:healthy_adult').shape).toBe('rounded');
    expect(node(l, 'schema:emotional_deprivation').bodyLines).toBe(7);
    expect(node(l, 'origin:emotional_deprivation').bodyLines).toBe(5);
    expect(node(l, 'origin:emotional_deprivation').shape).toBe('ellipse');
  });

  it('фигура режима по типу: критик — восьмиугольник, ребёнок — эллипс, копинг — по виду', () => {
    const l = layoutOf(
      {
        modeIds: [
          'punitive_critic',
          'vulnerable_child',
          'detached_protector',
          'overcontroller',
          'compliant_surrenderer',
        ],
      },
      1200,
    );
    expect(node(l, 'mode:punitive_critic').shape).toBe('octagon');
    expect(node(l, 'mode:vulnerable_child').shape).toBe('ellipse');
    expect(node(l, 'mode:detached_protector').shape).toBe('shield');
    expect(node(l, 'mode:overcontroller').shape).toBe('pentagon');
    expect(node(l, 'mode:compliant_surrenderer').shape).toBe('pill');
  });

  it('имя клиента — главная строка, название режима — мелко', () => {
    const n = node(layoutOf(RICH, 1200), 'mode:detached_protector');
    expect(n.label).toBe('Глиняная оболочка');
    expect(n.sublabel).toBe('Отстранённый Защитник');
    expect(n.name).toBe('Отстранённый Защитник');
  });
});

describe('раскладка: пустые секции', () => {
  it('пустая секция — одна пунктирная заготовка своего текста', () => {
    const l = layoutOf({}, 1200);
    const ph = l.nodes.filter((n) => n.kind === 'placeholder');
    expect(ph.map((n) => [n.section, n.label])).toEqual([
      ['modes', 'Режим не отмечен'],
      ['schemas', 'Схема не отмечена'],
      ['healthy', 'Здоровый Взрослый не отмечен'],
    ]);
  });

  it('есть режим — заготовка режимов уходит, остальные остаются', () => {
    const l = layoutOf({ modeIds: ['vulnerable_child'] }, 1200);
    expect(
      l.nodes.filter((n) => n.kind === 'placeholder').map((n) => n.section),
    ).toEqual(['schemas', 'healthy']);
  });
});

describe('раскладка: порядок по барицентру', () => {
  it('схема встаёт напротив режима, который на неё ссылается: у верхнего режима схема выше', () => {
    // критик ссылается на «Неуспешность», ребёнок — на «Покинутость»; по доменам
    // порядок обратный, а по режимам — «Неуспешность» первая.
    const l = layoutOf(
      {
        modeIds: ['punitive_critic', 'vulnerable_child'],
        schemaIds: ['abandonment', 'failure'],
        modeLinks: [
          mode('punitive_critic', { schemaIds: ['failure'] }),
          mode('vulnerable_child', { schemaIds: ['abandonment'] }),
        ],
      },
      1200,
    );
    expect(node(l, 'mode:punitive_critic').y).toBeLessThan(
      node(l, 'mode:vulnerable_child').y,
    );
    expect(node(l, 'schema:failure').y).toBeLessThan(
      node(l, 'schema:abandonment').y,
    );
  });

  it('режимы идут группами: критики, затем детские, затем копинги', () => {
    const l = layoutOf(
      {
        modeIds: [
          'detached_protector',
          'vulnerable_child',
          'punitive_critic',
          'compliant_surrenderer',
        ],
      },
      1200,
    );
    const order = bySection(l, 'modes')
      .sort((a, b) => a.y - b.y)
      .map((n) => n.modeId);
    expect(order).toEqual([
      'punitive_critic',
      'vulnerable_child',
      'compliant_surrenderer',
      'detached_protector',
    ]);
  });

  it('внутри группы режим без линий уходит в конец, хотя в реестре стоит первым', () => {
    const l = layoutOf(
      {
        modeIds: ['vulnerable_child', 'lonely_child', 'abandoned_child'],
        schemaIds: ['abandonment', 'failure'],
        modeLinks: [
          mode('abandoned_child', { schemaIds: ['abandonment'] }),
          mode('lonely_child', { schemaIds: ['failure'] }),
        ],
      },
      1200,
    );
    const order = bySection(l, 'modes')
      .sort((a, b) => a.y - b.y)
      .map((n) => n.modeId);
    expect(order).toEqual([
      'lonely_child',
      'abandoned_child',
      'vulnerable_child',
    ]);
  });

  it('схема без режимов не теряется, овал опыта стоит над своей схемой', () => {
    const l = layoutOf(
      {
        schemaIds: ['failure'],
        schemaLinks: [schema('failure', { origin: 'строгий отец' })],
      },
      1200,
    );
    const s = node(l, 'schema:failure');
    const o = node(l, 'origin:failure');
    expect(o.y + o.h).toBeLessThan(s.y);
  });
});
