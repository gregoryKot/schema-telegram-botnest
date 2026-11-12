// Сцена входа (docs/design/PAPER_2026-11.md, `SceneEntry`, партия b26): лист персика, на земле
// знак продукта крупно — плитка с дугой-ладонями и кругом, та же геометрия, что у BrandMark и
// favicon (shared/src/share/kit/brandMark.ts), — слева полоски-потребности стоят на земле, над
// ними петля ленты, справа легли камешки. Вход под заботу Здорового Взрослого, где замечают
// потребности, моменты и мысли. Каркас и тень — sceneKit (сплошной сдвинутый слой, без filter).
// Едет отдельным чанком (LoginShell, React.lazy): место под сцену держит рамка `.al-scene`.
import {
  ARC, ARC_D, CORE, MARK_VIEW, STRIPE_D, TILE_RX, fitTransform, markFit,
} from '../../../../shared/src/share/kit/brandMark';
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

/** Плитка знака: сторона и левый верхний угол в единицах холста; низ стоит на земле (y 212). */
const TILE = { x: 102, y: 90, s: 118 } as const;
const GROUND_Y = 212;

/** Полоски-потребности на земле: низ на линии земли, наклон — как у мотива Strokes. */
const STROKES = [
  { x: 38, h: 58, deg: -6, fill: INK.moss },
  { x: 58, h: 76, deg: 3, fill: INK.clay },
  { x: 78, h: 50, deg: -3, fill: INK.sage },
] as const;

/** Камешки — мотив Pebbles, лёгшие на землю справа от знака. */
const PEBBLES = [
  { cx: 238, cy: 202, fill: INK.moss },
  { cx: 262, cy: 199, fill: INK.brown },
  { cx: 284, cy: 202, fill: INK.clay },
] as const;

function MarkTile() {
  const k = TILE.s / MARK_VIEW;
  return (
    <g transform={`translate(${TILE.x} ${TILE.y}) scale(${k})`} data-brand-mark="scene">
      <rect width={MARK_VIEW} height={MARK_VIEW} rx={TILE_RX} fill="var(--bg)" />
      <path d={STRIPE_D} fill={INK.sage} />
      <g transform={fitTransform(markFit(false))}>
        <path d={ARC_D} fill="none" stroke={INK.moss} strokeWidth={ARC.width} strokeLinecap="round" />
        <circle cx={CORE.cx} cy={CORE.cy} r={CORE.r} fill={INK.clay} />
      </g>
    </g>
  );
}

export function SceneEntry({ hue = 45, className }: { hue?: number; className?: string }) {
  return (
    <SceneSvg hue={hue} patch={240} patchAt="tr" sheet="b" className={className}>
      <path d={`M30 ${GROUND_Y + 2} H290`} stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
      <Lift>
        {STROKES.map((s) => (
          <rect key={s.x} data-entry="stroke" x={s.x} y={GROUND_Y - s.h} width="15" height={s.h} rx="7.5" fill={s.fill}
                transform={`rotate(${s.deg} ${s.x + 7.5} ${GROUND_Y})`} />
        ))}
        {/* Петля ленты — мотив Ribbon, уменьшенный над полосками. */}
        <path data-entry="ribbon" transform="translate(28 40) scale(0.62)"
              d="M8 46 C 18 18, 54 10, 66 30 C 76 48, 44 60, 36 42 C 28 24, 66 6, 112 26"
              fill="none" stroke={INK.clay} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        <MarkTile />
        {PEBBLES.map((p) => (
          <ellipse key={p.cx} data-entry="pebble" cx={p.cx} cy={p.cy} rx="12" ry="8" fill={p.fill}
                   transform={`rotate(-14 ${p.cx} ${p.cy})`} />
        ))}
      </Lift>
    </SceneSvg>
  );
}

/** Вход ленивого чанка (LoginShell). */
export default SceneEntry;
