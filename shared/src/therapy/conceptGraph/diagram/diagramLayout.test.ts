import { describe, it, expect } from 'vitest';
import type { ConceptModeLink } from '../../../apiTypes';
import { buildConceptGraph } from '../conceptGraphModel';
import type { ConceptGraphSource } from '../conceptGraphTypes';
import { emptyModeLink } from '../modeLinks';
import { layoutConceptDiagram } from './diagramLayout';
import { SPACE, type DiagramLayout, type DiagramNode } from './diagramTypes';

const src = (patch: Partial<ConceptGraphSource> = {}): ConceptGraphSource => ({
  modeIds: [],
  schemaIds: [],
  modeLinks: [],
  ...patch,
});
const link = (modeId: string, patch: Partial<ConceptModeLink>) => ({
  ...emptyModeLink(modeId),
  ...patch,
});
const layout = (s: ConceptGraphSource, width = 1000): DiagramLayout =>
  layoutConceptDiagram(
    buildConceptGraph(s, (ty) => ty),
    width,
  );

const FULL = src({
  modeIds: [
    'vulnerable_child',
    'abandoned_child',
    'punitive_critic',
    'demanding_critic',
    'compliant_surrenderer',
    'detached_protector',
    'perfectionistic_oc',
    'healthy_adult',
  ],
  schemaIds: ['abandonment', 'defectiveness', 'unrelenting_standards'],
  modeLinks: [
    link('vulnerable_child', {
      alias: 'Маленькая Аня',
      schemaIds: ['abandonment', 'defectiveness'],
      needIds: ['attachment'],
    }),
    link('punitive_critic', {
      alias: 'Судья',
      schemaIds: ['unrelenting_standards'],
      needIds: ['limits'],
    }),
    link('detached_protector', { schemaIds: ['defectiveness'] }),
  ],
  earlyExperience: 'Строгий отец',
  triggers: 'Критика на работе',
  currentProblems: 'Выгорание',
  goals: 'Научиться отдыхать',
});

const node = (l: DiagramLayout, id: string): DiagramNode => {
  const n = l.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`нет фигуры ${id}`);
  return n;
};
const cx = (n: DiagramNode) => n.x + n.w / 2;

describe('зоны', () => {
  it('полная схема: шесть зон сверху вниз с зазором между ними', () => {
    const l = layout(FULL);
    expect(l.bands.map((b) => b.id)).toEqual([
      'healthy',
      'roots',
      'schemas',
      'backstage',
      'coping',
      'cost',
    ]);
    l.bands.slice(1).forEach((b, i) => {
      const prev = l.bands[i];
      expect(b.y).toBe(prev.y + prev.h + SPACE.zoneGap);
    });
    const last = l.bands[l.bands.length - 1];
    expect(l.height).toBe(last.y + last.h);
  });

  it('пустая схема: остаются только четыре зоны режимов с заготовками, линий нет', () => {
    const l = layout(src());
    expect(l.bands.map((b) => b.id)).toEqual([
      'healthy',
      'backstage',
      'coping',
    ]);
    expect(l.nodes.map((n) => [n.kind, n.lane]).sort()).toEqual(
      [
        ['placeholder', 'child'],
        ['placeholder', 'coping'],
        ['placeholder', 'critic'],
        ['placeholder', 'healthy'],
      ].sort(),
    );
    expect(l.edges).toEqual([]);
  });

  it('зона без содержимого не рисуется: корни, схемы, цена', () => {
    const l = layout(src({ modeIds: ['vulnerable_child'] }));
    expect(l.bands.map((b) => b.id)).toEqual([
      'healthy',
      'backstage',
      'coping',
    ]);
  });

  it('корни появляются от раннего опыта, от текста потребностей и от потребностей в связях', () => {
    const ids = (s: ConceptGraphSource) => layout(s).bands.map((b) => b.id);
    expect(ids(src({ earlyExperience: 'x' }))).toContain('roots');
    expect(ids(src({ unmetNeeds: 'x' }))).toContain('roots');
    expect(
      ids(
        src({
          modeIds: ['vulnerable_child'],
          modeLinks: [link('vulnerable_child', { needIds: ['play'] })],
        }),
      ),
    ).toContain('roots');
    expect(ids(src({ modeIds: ['vulnerable_child'] }))).not.toContain('roots');
  });

  it('цель терапии — фигура в зоне здоровых режимов; проблемы — своя зона', () => {
    const l = layout(src({ goals: 'отдыхать', currentProblems: 'выгорание' }));
    expect(node(l, 'goals').sublabel).toBe('отдыхать');
    expect(node(l, 'problems').shape).toBe('tag');
    expect(l.bands.map((b) => b.id)).toContain('cost');
    const healthy = l.bands[0];
    const goals = node(l, 'goals');
    expect(goals.y).toBeGreaterThanOrEqual(healthy.y);
    expect(goals.y + goals.h).toBeLessThanOrEqual(healthy.y + healthy.h);
    expect(layout(src()).nodes.some((n) => n.id === 'goals')).toBe(false);
  });

  it('текст потребностей остаётся на схеме отдельной фигурой, а не пропадает', () => {
    const l = layout(src({ unmetNeeds: 'нужна опора' }));
    expect(node(l, 'unmet').sublabel).toBe('нужна опора');
  });
});

describe('фигуры', () => {
  it('форма говорит о роли: ребёнок — эллипс, критик — восьмиугольник, копинги — по виду', () => {
    const l = layout(FULL);
    const shape = (id: string) => node(l, `mode:${id}`).shape;
    expect(shape('vulnerable_child')).toBe('ellipse');
    expect(shape('punitive_critic')).toBe('octagon');
    expect(shape('perfectionistic_oc')).toBe('pentagon');
    expect(shape('detached_protector')).toBe('shield');
    expect(shape('compliant_surrenderer')).toBe('pill');
    expect(shape('healthy_adult')).toBe('rounded');
    expect(node(l, 'trigger').shape).toBe('cloud');
  });

  it('имя клиента — главная строка, название режима — мелко; у копинга без имени мелко вид', () => {
    const l = layout(FULL);
    const aya = node(l, 'mode:vulnerable_child');
    expect([aya.label, aya.sublabel, aya.name]).toEqual([
      'Маленькая Аня',
      'Уязвимый Ребёнок',
      'Уязвимый Ребёнок',
    ]);
    const prot = node(l, 'mode:detached_protector');
    expect([prot.label, prot.sublabel]).toEqual([
      'Отстранённый Защитник',
      'Избегание',
    ]);
  });

  it('режим без связей помечен empty, со связями — нет', () => {
    const l = layout(FULL);
    expect(node(l, 'mode:abandoned_child').empty).toBe(true);
    expect(node(l, 'mode:vulnerable_child').empty).toBe(false);
  });

  it('заготовка несёт полный текст клетки в title и короткую подпись', () => {
    const l = layout(src());
    const p = node(l, 'placeholder:child');
    expect(p.label).toBe('Детский режим не отмечен');
    expect(p.title).toMatch(/Без детского режима непонятно/);
    expect(node(l, 'placeholder:healthy').label).toBe(
      'Здоровый Взрослый не отмечен',
    );
    expect(node(l, 'placeholder:critic').label).toBe('Критик не отмечен');
    expect(node(l, 'placeholder:coping').label).toBe('Копинг не отмечен');
  });
});

describe('за кулисами: дети слева, критики справа, а на узком — друг под другом', () => {
  const two = src({
    modeIds: [
      'vulnerable_child',
      'lonely_child',
      'punitive_critic',
      'demanding_critic',
    ],
  });
  const side = (l: DiagramLayout, lane: string) =>
    l.nodes.filter((n) => n.kind === 'mode' && n.lane === lane);

  it('на 1000 в одном ряду, дети левее', () => {
    const l = layout(two, 1000);
    const kids = side(l, 'child');
    const critics = side(l, 'critic');
    expect(Math.max(...kids.map((n) => n.x + n.w))).toBeLessThan(
      Math.min(...critics.map((n) => n.x)),
    );
    expect(kids[0].y).toBe(critics[0].y);
  });

  it('на 360 критики сверху, дети снизу', () => {
    const l = layout(two, 360);
    const kids = side(l, 'child');
    const critics = side(l, 'critic');
    expect(Math.max(...critics.map((n) => n.y + n.h))).toBeLessThanOrEqual(
      Math.min(...kids.map((n) => n.y)),
    );
  });

  it('триггер стоит слева от детей в одном ряду, если влезает', () => {
    const l = layout({ ...two, triggers: 'критика' }, 1100);
    const t = node(l, 'trigger');
    const kid = node(l, 'mode:vulnerable_child');
    expect(t.x + t.w).toBeLessThan(kid.x);
    expect(t.y + t.h / 2).toBe(kid.y + kid.h / 2);
  });

  it('пустой кластер — заготовка своего вида', () => {
    const l = layout(src({ modeIds: ['punitive_critic'] }));
    expect(l.nodes.some((n) => n.id === 'placeholder:child')).toBe(true);
    expect(l.nodes.some((n) => n.id === 'placeholder:critic')).toBe(false);
  });
});

describe('геометрия', () => {
  const widths = [240, 320, 360, 390, 600, 1000, 1400];

  it.each(widths)('на ширине %i все фигуры внутри [0, ширина]', (w) => {
    const l = layout(FULL, w);
    for (const n of l.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(l.width);
    }
  });

  it.each(widths)('на ширине %i фигуры не перекрываются', (w) => {
    const l = layout(FULL, w);
    for (const a of l.nodes) {
      for (const b of l.nodes) {
        if (a.id >= b.id) continue;
        const apart =
          a.x + a.w <= b.x ||
          b.x + b.w <= a.x ||
          a.y + a.h <= b.y ||
          b.y + b.h <= a.y;
        expect(apart, `${a.id} и ${b.id}`).toBe(true);
      }
    }
  });

  it('фигуры каждой зоны лежат внутри своей зоны', () => {
    const l = layout(FULL);
    for (const n of l.nodes) {
      const band = l.bands.find((b) => n.y >= b.y && n.y + n.h <= b.y + b.h);
      expect(band, n.id).toBeTruthy();
    }
  });

  it('раскладка детерминирована', () => {
    expect(layout(FULL, 700)).toEqual(layout(FULL, 700));
  });

  it('на телефоне (358 — экран 390 минус поля листа) режим сужается, чтобы два встали в ряд', () => {
    const l = layout(
      src({ modeIds: ['vulnerable_child', 'lonely_child'] }),
      358,
    );
    const [a, b] = l.nodes.filter((n) => n.lane === 'child');
    expect(a.y).toBe(b.y);
    expect(a.w).toBeLessThan(168);
    expect(a.w).toBeGreaterThanOrEqual(148);
  });
});

describe('схемы: порядок по барицентру', () => {
  it('схема, питающая самый правый режим, правее схемы левого режима', () => {
    // По доменам abandonment (отвержение) идёт раньше failure (автономия):
    // барицентр обязан переставить их, потому что abandonment питает критика справа.
    const l = layout(
      src({
        modeIds: ['vulnerable_child', 'punitive_critic'],
        schemaIds: ['abandonment', 'failure'],
        modeLinks: [
          link('vulnerable_child', { schemaIds: ['failure'] }),
          link('punitive_critic', { schemaIds: ['abandonment'] }),
        ],
      }),
    );
    expect(cx(node(l, 'schema:failure'))).toBeLessThan(
      cx(node(l, 'schema:abandonment')),
    );
  });

  it('схема без линий — в конце, а схема из связей без отметки в концептуализации всё равно показана', () => {
    const l = layout(
      src({
        modeIds: ['vulnerable_child'],
        schemaIds: ['emotional_deprivation'],
        modeLinks: [link('vulnerable_child', { schemaIds: ['failure'] })],
      }),
    );
    expect(cx(node(l, 'schema:failure'))).toBeLessThan(
      cx(node(l, 'schema:emotional_deprivation')),
    );
  });

  it('потребность стоит по барицентру режимов, к которым ведёт', () => {
    const l = layout(
      src({
        modeIds: ['vulnerable_child', 'punitive_critic'],
        modeLinks: [
          link('vulnerable_child', { needIds: ['limits'] }),
          link('punitive_critic', { needIds: ['attachment'] }),
        ],
      }),
    );
    expect(cx(node(l, 'need:limits'))).toBeLessThan(
      cx(node(l, 'need:attachment')),
    );
  });
});
