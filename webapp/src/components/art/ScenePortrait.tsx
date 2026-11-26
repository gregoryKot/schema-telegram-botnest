// Сцена листа «Мой портрет» (docs/design/PAPER_2026-11.md, «Сцены», b21): на линии земли пять
// полосок-потребностей цветами данных (needDataColor — палитра данных, порядок NEED_ORDER), над
// каждой — столько слоёв (мотив Layers), сколько её схем в портрете. Слои — только из данных:
// у потребности без схем слоёв нет, пустой портрет — пять полосок на земле и ничего сверху.
// Больше LAYER_MAX слоёв стопка не растёт — число рядом, в строках листа.
import { needDataColor } from '../needDataColor';
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

export interface ScenePortraitNeed {
  id: string;
  /** Сколько схем портрета стоит за потребностью. */
  count: number;
}

const LAYER_MAX = 5;
const GROUND = 214;
const STRIP = { w: 30, h: 74 } as const;
const LAYER = { w: 40, h: 17, step: 22 } as const;
const X0 = 68;
const GAP = 46;

/** Слой той же потребности светлее полоски: цвет данных, разбавленный листом. */
const layerFill = (color: string) => `color-mix(in srgb, ${color} 62%, var(--surface))`;

export function ScenePortrait({ needs, hue = 135 }: { needs: ScenePortraitNeed[]; hue?: number }) {
  return (
    <SceneSvg hue={hue} patch={70} patchAt="tr" sheet="a" className="scn-portrait">
      <Lift>
        <path d={`M44 ${GROUND} H276`} stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        {needs.map((n, i) => {
          const color = needDataColor(n.id) ?? INK.sage;
          const cx = X0 + i * GAP;
          const top = GROUND - STRIP.h;
          const layers = Math.min(LAYER_MAX, Math.max(0, n.count));
          return (
            <g key={n.id} data-need={n.id}>
              <rect x={cx - STRIP.w / 2} y={top} width={STRIP.w} height={STRIP.h} rx="10" fill={color} />
              {Array.from({ length: layers }, (_, k) => (
                <rect key={k} data-layer="" x={cx - LAYER.w / 2 + (k % 2 ? 3 : -3)} y={top - (k + 1) * LAYER.step}
                  width={LAYER.w} height={LAYER.h} rx="8" fill={layerFill(color)} />
              ))}
            </g>
          );
        })}
      </Lift>
    </SceneSvg>
  );
}
