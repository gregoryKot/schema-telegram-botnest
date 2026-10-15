import { describe, it, expect } from 'vitest';
import type { ConceptModeLink } from '../../../apiTypes';
import { buildConceptGraph } from '../conceptGraphModel';
import type { ConceptGraphSource } from '../conceptGraphTypes';
import { emptyModeLink } from '../modeLinks';
import { layoutConceptDiagram } from './diagramLayout';
import type { DiagramLayout } from './diagramTypes';

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
const of = (l: DiagramLayout, kind: string) =>
  l.edges.filter((e) => e.kind === kind);

const ALL = [
  'vulnerable_child',
  'punitive_critic',
  'detached_protector',
  'healthy_adult',
];

describe('линии «питает»: ровно по связям', () => {
  const s = src({
    modeIds: ALL,
    modeLinks: [
      link('vulnerable_child', {
        schemaIds: ['abandonment', 'defectiveness'],
        needIds: ['attachment', 'limits'],
      }),
      link('punitive_critic', {
        schemaIds: ['defectiveness'],
        needIds: ['limits'],
      }),
      link('detached_protector', {}),
    ],
  });

  it('схема → режим и потребность → режим: одна линия на связь, не больше', () => {
    const l = layout(s);
    expect(
      of(l, 'feeds')
        .map((e) => `${e.from}>${e.to}`)
        .sort(),
    ).toEqual([
      'schema:abandonment>mode:vulnerable_child',
      'schema:defectiveness>mode:punitive_critic',
      'schema:defectiveness>mode:vulnerable_child',
    ]);
    expect(
      of(l, 'need')
        .map((e) => `${e.from}>${e.to}`)
        .sort(),
    ).toEqual([
      'need:attachment>mode:vulnerable_child',
      'need:limits>mode:punitive_critic',
      'need:limits>mode:vulnerable_child',
    ]);
  });

  it('связь убрали — линии нет', () => {
    const l = layout({ ...s, modeLinks: [link('vulnerable_child', {})] });
    expect(of(l, 'feeds')).toEqual([]);
    expect(of(l, 'need')).toEqual([]);
  });

  it('режим снят с карты — его связи линий не рисуют', () => {
    const l = layout({ ...s, modeIds: ['healthy_adult'] });
    expect(of(l, 'feeds')).toEqual([]);
  });

  it('feeds — цвет домена и приглушённая, need — пунктир', () => {
    const l = layout(s);
    expect(of(l, 'feeds')[0].opacity).toBeLessThan(0.6);
    expect(of(l, 'feeds')[0].dashed).toBeFalsy();
    expect(of(l, 'need').every((e) => e.dashed)).toBe(true);
    expect(of(l, 'need')[0].color).toBe('var(--text-faint)');
  });

  it('каждое ребро ссылается на существующие фигуры, а кривая — цепочка кубических сегментов', () => {
    const l = layout(s);
    const ids = new Set(l.nodes.map((n) => n.id));
    expect(l.edges.length).toBeGreaterThan(0);
    for (const e of l.edges) {
      expect(ids.has(e.from), e.id).toBe(true);
      expect(ids.has(e.to), e.id).toBe(true);
      expect((e.points.length - 1) % 3, e.id).toBe(0);
    }
  });

  it('линия идёт сверху вниз: конец касается верха режима, начало — низа схемы', () => {
    const l = layout(s);
    const e = of(l, 'feeds').find(
      (x) => x.to === 'mode:punitive_critic',
    ) as DiagramLayout['edges'][0];
    const from = l.nodes.find((n) => n.id === e.from)!;
    const to = l.nodes.find((n) => n.id === e.to)!;
    const start = e.points[0];
    const end = e.points[e.points.length - 1];
    expect(start.y).toBeCloseTo(from.y + from.h, 0);
    expect(end.y).toBeGreaterThanOrEqual(to.y);
    expect(end.y).toBeLessThan(to.y + to.h / 2);
    expect(end.x).toBeGreaterThan(to.x);
    expect(end.x).toBeLessThan(to.x + to.w);
  });

  it('схема питает здоровый режим сверху: линия идёт вверх, от верха схемы к низу режима', () => {
    const l = layout(
      src({
        modeIds: ['healthy_adult'],
        modeLinks: [link('healthy_adult', { schemaIds: ['failure'] })],
      }),
    );
    const e = of(l, 'feeds')[0];
    const schema = l.nodes.find((n) => n.id === e.from)!;
    const mode = l.nodes.find((n) => n.id === e.to)!;
    expect(mode.y).toBeLessThan(schema.y);
    expect(e.points[0].y).toBeCloseTo(schema.y, 0);
    expect(e.points[e.points.length - 1].y).toBeLessThanOrEqual(
      mode.y + mode.h,
    );
  });

  it('несколько линий к одному режиму приходят в разные точки верха', () => {
    const l = layout(
      src({
        modeIds: ['vulnerable_child'],
        modeLinks: [
          link('vulnerable_child', {
            schemaIds: ['abandonment', 'defectiveness', 'failure'],
          }),
        ],
      }),
    );
    const ends = of(l, 'feeds').map((e) => e.points[e.points.length - 1].x);
    expect(new Set(ends.map((x) => Math.round(x))).size).toBe(3);
  });
});

describe('стрелки между кластерами: появляются и не появляются', () => {
  const kinds = (s: ConceptGraphSource, width = 1000) =>
    layout(s, width)
      .edges.map((e) => e.kind)
      .sort();
  const withLabel = (l: DiagramLayout, kind: string) =>
    of(l, kind)
      .filter((e) => e.label)
      .map((e) => e.label);

  it('presses: критик давит на ребёнка — только когда есть оба', () => {
    expect(
      kinds(src({ modeIds: ['vulnerable_child', 'punitive_critic'] })),
    ).toEqual(['presses']);
    expect(kinds(src({ modeIds: ['punitive_critic'] }))).toEqual([]);
    expect(kinds(src({ modeIds: ['vulnerable_child'] }))).toEqual([]);
    const l = layout(src({ modeIds: ['vulnerable_child', 'punitive_critic'] }));
    expect(withLabel(l, 'presses')).toEqual(['давит']);
    expect(of(l, 'presses')[0].color).toBe('var(--accent-red)');
    expect(of(l, 'presses')[0].from).toBe('mode:punitive_critic');
    expect(of(l, 'presses')[0].to).toBe('mode:vulnerable_child');
  });

  it('presses горизонтальна, когда кластеры рядом, и вертикальна, когда друг под другом', () => {
    const s = src({ modeIds: ['vulnerable_child', 'punitive_critic'] });
    const wide = of(layout(s, 1000), 'presses')[0].points;
    expect(wide[0].x).toBeGreaterThan(wide[3].x);
    expect(wide[0].y).toBeCloseTo(wide[3].y, 0);
    const narrow = of(layout(s, 360), 'presses')[0].points;
    expect(narrow[3].y).toBeGreaterThan(narrow[0].y);
  });

  it('protects: по стрелке от каждого непустого кластера, подпись одна', () => {
    const both = layout(
      src({
        modeIds: ['vulnerable_child', 'punitive_critic', 'detached_protector'],
      }),
    );
    expect(of(both, 'protects')).toHaveLength(2);
    expect(withLabel(both, 'protects')).toEqual(['боль включает копинг']);
    const onlyKid = layout(
      src({ modeIds: ['vulnerable_child', 'detached_protector'] }),
    );
    expect(of(onlyKid, 'protects')).toHaveLength(1);
    expect(of(onlyKid, 'protects')[0].from).toBe('mode:vulnerable_child');
    expect(of(onlyKid, 'protects')[0].to).toBe('mode:detached_protector');
    const noCoping = layout(
      src({ modeIds: ['vulnerable_child', 'punitive_critic'] }),
    );
    expect(of(noCoping, 'protects')).toEqual([]);
    const onlyCoping = layout(src({ modeIds: ['detached_protector'] }));
    expect(of(onlyCoping, 'protects')).toEqual([]);
  });

  it('triggers: триггер запускает цикл — только когда есть и триггер, и дети', () => {
    const withBoth = layout(
      src({ modeIds: ['vulnerable_child'], triggers: 'критика' }),
    );
    expect(of(withBoth, 'triggers')).toHaveLength(1);
    expect(withLabel(withBoth, 'triggers')).toEqual(['запускает']);
    expect(of(withBoth, 'triggers')[0].from).toBe('trigger');
    expect(kinds(src({ triggers: 'критика' }))).toEqual([]);
    expect(kinds(src({ modeIds: ['vulnerable_child'] }))).toEqual([]);
    expect(
      kinds(src({ modeIds: ['punitive_critic'], triggers: 'критика' })),
    ).toEqual([]);
  });

  it('triggers вертикальна, когда триггер и дети не помещаются в один ряд', () => {
    const l = layout(
      src({ modeIds: ['vulnerable_child'], triggers: 'критика' }),
      360,
    );
    const p = of(l, 'triggers')[0].points;
    expect(p[3].y).toBeGreaterThan(p[0].y);
  });

  it('cost: копинг приводит к цене — только когда есть и копинг, и проблемы', () => {
    const both = layout(
      src({ modeIds: ['detached_protector'], currentProblems: 'выгорание' }),
    );
    expect(of(both, 'cost')).toHaveLength(1);
    expect(withLabel(both, 'cost')).toEqual(['цена']);
    expect(of(both, 'cost')[0].to).toBe('problems');
    expect(kinds(src({ currentProblems: 'выгорание' }))).toEqual([]);
    expect(kinds(src({ modeIds: ['detached_protector'] }))).toEqual([]);
  });

  it('подпись стоит на кривой: labelAt в границах раскладки', () => {
    const l = layout(
      src({
        modeIds: ['vulnerable_child', 'punitive_critic', 'detached_protector'],
        triggers: 'критика',
        currentProblems: 'выгорание',
      }),
    );
    const labelled = l.edges.filter((e) => e.label);
    expect(labelled).toHaveLength(4);
    for (const e of labelled) {
      expect(e.labelAt!.x).toBeGreaterThan(0);
      expect(e.labelAt!.x).toBeLessThan(l.width);
      expect(e.labelAt!.y).toBeGreaterThan(0);
      expect(e.labelAt!.y).toBeLessThan(l.height);
    }
  });

  it('подпись между зонами стоит в зазоре над зоной цели, а не на её заголовке', () => {
    const l = layout(
      src({ modeIds: ['vulnerable_child', 'detached_protector'] }),
    );
    const coping = l.bands.find((b) => b.id === 'coping')!;
    const label = of(l, 'protects')[0].labelAt!;
    expect(label.y).toBeLessThan(coping.y);
  });
});
