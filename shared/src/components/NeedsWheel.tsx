// Колесо потребностей (история дня): лепестки-оценки, контур «колеса детства», индекс в
// центре (wheelCenter.ts). Единственная копия (правило №3). Язык бумаги (редизайн 2026-11,
// docs/design/APP_2026-11.md, today-history-day): у каждой потребности свой сектор белого
// листа, оценка — вырезанный лепесток цветом данных потребности (`ink`, решение 7 «Палитра
// данных»; без него — NEED_COLORS) с тенью сплошным сдвинутым слоем, детство — сплошной
// контур без пунктира, индекс — Literata. Тени и линейки — классы nw-* (styles/history.css):
// тон бумаги листа (--h у родителя), а не литерал. Пусто — пустые секторы и «—» в центре.
import type { Need } from '../types';
import { NEED_COLORS } from '../needs/needColors';
import { wheelCenter } from '../history/wheelCenter';

const W = 360,
  H = 280,
  CX = W / 2,
  CY = H / 2,
  R = CY - 20,
  CENTER_R = 41;
const SPREAD = (34 * Math.PI) / 180;

function petalPath(r: number, ca: number): string {
  if (r < 1) return '';
  const [a1, a2] = [ca - SPREAD, ca + SPREAD];
  const p = (a: number) =>
    `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;
  return `M ${CX} ${CY} L ${p(a1)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${p(a2)} Z`;
}
function arcPath(r: number, ca: number): string {
  const p = (a: number) =>
    `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;
  return `M ${p(ca - SPREAD)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${p(ca + SPREAD)}`;
}
/** Радиус лепестка по оценке 0–10: площадь растёт с оценкой, а не радиус. */
const radius = (v: number | undefined) =>
  Math.sqrt(Math.min(10, Math.max(0, v ?? 0)) / 10) * R;

export function NeedsWheel({
  needs,
  ratings,
  prevRatings = {},
  childhoodRatings = {},
  ink = {},
  onClickNeed,
  onClickCenter,
}: {
  needs: Need[];
  ratings: Record<string, number>;
  prevRatings?: Record<string, number>;
  childhoodRatings?: Partial<Record<string, number>>;
  /** Цвет данных потребности по id (var-токен); нет в карте — NEED_COLORS. */
  ink?: Partial<Record<string, string>>;
  onClickNeed?: (n: Need) => void;
  onClickCenter?: () => void;
}) {
  const center = wheelCenter(
    needs.map((nd) => nd.id),
    ratings,
    prevRatings,
  );
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / needs.length;
  const sectors = needs.map((nd, i) => (
    <path key={nd.id} d={petalPath(R, angle(i))} />
  ));
  const petals = needs
    .map((nd, i) => ({
      id: nd.id,
      d: petalPath(radius(ratings[nd.id]), angle(i)),
      fill: ink[nd.id] ?? NEED_COLORS[nd.id] ?? '#888',
    }))
    .filter((p) => p.d);
  const hasChildhood = Object.keys(childhoodRatings).length > 0;
  return (
    <svg
      className="nw"
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', width: '100%', height: 'auto', maxHeight: H }}
    >
      <g className="nw-shade" transform="translate(5 6)">
        {sectors}
      </g>
      <g className="nw-sector">{sectors}</g>
      <g className="nw-rule">
        {needs.map((nd, i) =>
          [0.25, 0.5, 0.75].map((f) => (
            <path key={`${nd.id}-${f}`} d={arcPath(R * f, angle(i))} />
          )),
        )}
      </g>
      <g className="nw-petal-shade" transform="translate(3 4)">
        {petals.map((p) => (
          <path key={p.id} d={p.d} />
        ))}
      </g>
      {petals.map((p) => (
        <path key={p.id} d={p.d} fill={p.fill} data-petal={p.id} />
      ))}
      {hasChildhood && (
        <g className="nw-childhood" data-layer="childhood">
          {needs.map((nd, i) => {
            const d = petalPath(radius(childhoodRatings[nd.id]), angle(i));
            return d ? <path key={nd.id} d={d} /> : null;
          })}
        </g>
      )}
      <circle className="nw-shade" cx={CX + 3} cy={CY + 4} r={CENTER_R} />
      <circle className="nw-center" cx={CX} cy={CY} r={CENTER_R} />
      <text className="nw-label" x={CX} y={CY - 19} textAnchor="middle">
        индекс
      </text>
      <text className="nw-index" x={CX} y={CY + 10} textAnchor="middle">
        {center.index}
      </text>
      {center.prev !== null && (
        <text className="nw-label" x={CX} y={CY + 27} textAnchor="middle">
          {center.prev}
        </text>
      )}
      {onClickNeed &&
        needs.map((nd, i) => (
          <path
            key={`h-${nd.id}`}
            d={petalPath(R, angle(i))}
            fill="transparent"
            onClick={() => onClickNeed(nd)}
            style={{ cursor: 'pointer' }}
          />
        ))}
      {onClickCenter && (
        <circle
          cx={CX}
          cy={CY}
          r={CENTER_R}
          fill="transparent"
          onClick={onClickCenter}
          className="u-pointer"
        />
      )}
    </svg>
  );
}
