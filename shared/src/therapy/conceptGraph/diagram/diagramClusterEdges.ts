// Стрелки между группами фигур: Критик давит на Ребёнка, боль включает копинг,
// триггер запускает цикл, копинг приводит к цене. Конец у стрелки — ближайшая
// к другому кластеру фигура; подпись у середины.
import { smoothSide } from './diagramCurves';
import {
  bottomRow,
  cx,
  cy,
  edge,
  mean,
  nearest,
  topRow,
} from './diagramEdgeKit';
import { portPoint } from './diagramPorts';
import { routeVertical, type Lane } from './diagramRoute';
import {
  SPACE,
  type DiagramBand,
  type DiagramEdge,
  type DiagramNode,
  type Pt,
} from './diagramTypes';

export function clusterEdges(
  nodes: DiagramNode[],
  width: number,
  bands: DiagramBand[],
  taken: Lane[],
): DiagramEdge[] {
  const modes = (lane: string) =>
    nodes.filter((n) => n.kind === 'mode' && n.lane === lane);
  const kids = modes('child');
  const critics = modes('critic');
  const copings = modes('coping');
  const trigger = nodes.find((n) => n.kind === 'trigger');
  const problems = nodes.find((n) => n.kind === 'problems');
  const out: DiagramEdge[] = [];

  /** Сверху вниз, огибая чужие фигуры. */
  const down = (a: DiagramNode, b: DiagramNode, ua = 0.5, ub = 0.5): Pt[] =>
    routeVertical(
      portPoint(a, 'bottom', ua),
      portPoint(b, 'top', ub),
      nodes.filter((n) => n !== a && n !== b),
      width,
      taken,
    );

  /** Подпись стрелки между зонами стоит в зазоре над зоной цели, а не поверх её заголовка. */
  const gapAbove = (n: DiagramNode) => {
    const band = bands.find((b) => b.y <= n.y && n.y <= b.y + b.h);
    return band ? band.y - SPACE.zoneGap / 2 : undefined;
  };

  if (kids.length > 0 && critics.length > 0) {
    const c = nearest(bottomRow(critics), mean(kids.map(cx)));
    const sideBySide =
      Math.min(...critics.map((n) => n.x)) >=
      Math.max(...kids.map((n) => n.x + n.w));
    if (sideBySide) {
      const k = kids.reduce((b, n) => (n.x + n.w > b.x + b.w ? n : b));
      const edgeC = critics.reduce((b, n) => (n.x < b.x ? n : b));
      const pts = smoothSide(
        { x: edgeC.x, y: cy(edgeC) },
        { x: k.x + k.w, y: cy(k) },
      );
      out.push(edge('presses', edgeC, k, pts, 'var(--accent-red)', 'давит'));
    } else {
      const k = nearest(topRow(kids), cx(c));
      out.push(edge('presses', c, k, down(c, k), 'var(--accent-red)', 'давит'));
    }
  }

  if (copings.length > 0) {
    const sources = [kids, critics].filter((g) => g.length > 0);
    const picks = sources.map((g) => {
      const t = nearest(topRow(copings), mean(g.map(cx)));
      return { s: nearest(bottomRow(g), cx(t)), t };
    });
    const shared = picks.length === 2 && picks[0].t === picks[1].t;
    picks.forEach(({ s, t }, i) => {
      const ub = shared ? (i === 0 ? 0.35 : 0.65) : 0.5;
      const label = i === 0 ? 'боль включает копинг' : undefined;
      out.push(
        edge(
          'protects',
          s,
          t,
          down(s, t, 0.5, ub),
          'var(--text-sub)',
          label,
          gapAbove(t),
        ),
      );
    });
  }

  if (trigger && kids.length > 0) {
    const beside = kids.filter(
      (k) =>
        k.x >= trigger.x + trigger.w &&
        k.y < trigger.y + trigger.h &&
        k.y + k.h > trigger.y,
    );
    if (beside.length > 0) {
      const k = beside.reduce((b, n) => (n.x < b.x ? n : b));
      const pts = smoothSide(
        { x: trigger.x + trigger.w, y: cy(trigger) },
        { x: k.x, y: cy(k) },
      );
      out.push(
        edge('triggers', trigger, k, pts, 'var(--text-sub)', 'запускает'),
      );
    } else {
      const below = kids.filter((k) => k.y >= trigger.y + trigger.h);
      if (below.length > 0) {
        const k = nearest(topRow(below), cx(trigger));
        out.push(
          edge(
            'triggers',
            trigger,
            k,
            down(trigger, k),
            'var(--text-sub)',
            'запускает',
          ),
        );
      }
    }
  }

  if (copings.length > 0 && problems) {
    const s = nearest(bottomRow(copings), cx(problems));
    out.push(
      edge(
        'cost',
        s,
        problems,
        down(s, problems),
        'var(--accent-red)',
        'цена',
        gapAbove(problems),
      ),
    );
  }
  return out;
}
