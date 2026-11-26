// Сцены приложения, вторая половина (первая — AppScenes.tsx; язык — docs/design/PAPER_2026-11.md):
//  • SceneJourney — «Мой путь»: стопка листов-записей на земле, верхний исписан; высота
//    стопки — по числу шагов (1, 2–3, 4–7… до шести листов); ноль шагов — пустая земля.
//  • ScenePathStart — путь начинается с одной отметки: на линии земли одна полоска, у
//    основания росток, рядом стопка пустых листов-силуэтов (бледные, без тени — ещё не легли).
//  • SceneConceptStart — пустая схема случая: внизу на земле полоска-потребность, поверх неё
//    два слоя (мотив Layers), третий ещё не положен (бледный, сдвинут, без тени).
//  • DoneScene — сцена «готово» сущности по ENTITY_LOOK: экран не выбирает её на месте.
import type { EntityId } from '../../../../shared/src/theme/entityLook';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';
import { SceneBreath, ScenePebbleLaid, Sprout } from './AppScenes';
import { SceneCheckIn } from './LandingScenesMore';

/** Листы стопки снизу вверх: чередуют сдвиг и наклон, цвета не в тон шалфейному листу. */
const STACK_FILL = [INK.amberSoft, INK.tealSoft, INK.sky, INK.amberSoft, INK.tealSoft] as const;
const STACK_MAX = 6;

/** Сколько листов в стопке на `count` шагов пути: 0 → 0, 1 → 1, 2–3 → 2, 4–7 → 3 … не больше шести. */
const stackSize = (count: number) => (count >= 1 ? Math.min(STACK_MAX, 1 + Math.floor(Math.log2(count))) : 0);

export function SceneJourney({ count, hue = 135 }: { count: number; hue?: number }) {
  const n = stackSize(count);
  const sheet = (k: number) => ({ x: 82 + (k % 2 ? 8 : -4), y: 112 - k * 14, deg: k % 2 ? 2.5 : -3 });
  return (
    <SceneSvg hue={hue} patch={45} patchAt="tr" sheet="b">
      <Lift>
        <path d="M44 214 H276" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        {Array.from({ length: n }, (_, k) => {
          const s = sheet(k);
          const top = k === n - 1;
          return (
            <g key={k} data-sheet={k} transform={`rotate(${s.deg} ${s.x + 80} ${s.y + 50})`}>
              <rect x={s.x} y={s.y} width="160" height="100" rx="12" fill={top ? INK.sheet : STACK_FILL[k % STACK_FILL.length]} />
              {top && [24, 42, 60].map((dy, i) => (
                <rect key={dy} x={s.x + 20} y={s.y + dy} width={i === 2 ? 60 : 112} height="8" rx="4" fill={INK.brown} fillOpacity=".28" />
              ))}
            </g>
          );
        })}
      </Lift>
    </SceneSvg>
  );
}

/** Пустые листы-силуэты стопкой на земле: ещё не легли — бледные и без тени. Тон сплошной, не
 *  прозрачность: полупрозрачные листы двоились краями там, где ложатся друг на друга (глубина в
 *  языке — сплошным слоем). Стопка снизу вверх: нижний лист чуть глубже, верхний — бумага страницы. */
const BLANKS = [
  { x: 166, y: 148, deg: -3, fill: 'color-mix(in srgb, var(--text) 16%, var(--bg))' },
  { x: 174, y: 134, deg: 2.5, fill: 'color-mix(in srgb, var(--text) 8%, var(--bg))' },
  { x: 170, y: 120, deg: -1.5, fill: 'var(--bg)' },
] as const;

export function ScenePathStart({ hue = 135 }: { hue?: number }) {
  return (
    <SceneSvg hue={hue} patch={70} patchAt="bl" sheet="c">
      {BLANKS.map((b) => (
        <rect key={b.y} data-blank="" x={b.x} y={b.y} width="104" height="58" rx="10" fill={b.fill} transform={`rotate(${b.deg} ${b.x + 52} ${b.y + 29})`} />
      ))}
      <Lift>
        <path d="M36 210 H284" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <rect x="88" y="92" width="28" height="114" rx="14" fill={INK.moss} />
        <path d="M120 206 C118 186 128 174 144 170 C146 188 138 202 120 206 Z" fill={INK.moss} />
      </Lift>
    </SceneSvg>
  );
}

/** Слои схемы случая снизу вверх: потребность (мох) на земле, два слоя поверх неё. */
const CONCEPT_LAYERS = [
  { x: 60, y: 182, w: 200, fill: INK.moss },
  { x: 80, y: 154, w: 160, fill: INK.sage },
  { x: 102, y: 126, w: 116, fill: INK.slate },
] as const;

export function SceneConceptStart({ hue = 70 }: { hue?: number }) {
  return (
    <SceneSvg hue={hue} patch={240} patchAt="tr" sheet="b">
      <rect x="168" y="74" width="84" height="26" rx="13" fill={INK.clay} fillOpacity=".35" transform="rotate(-8 210 87)" />
      <Lift>
        <path d="M36 212 H284" stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        {CONCEPT_LAYERS.map((l) => <rect key={l.y} x={l.x} y={l.y} width={l.w} height="26" rx="13" fill={l.fill} />)}
      </Lift>
    </SceneSvg>
  );
}

/** Сцена «готово» сущности: знак с ростком, камешек лёг, дыхание улеглось или лист дня в серии
 *  (`days` — дни серии вместе с сегодняшним, только реальные; без них — один сегодняшний лист). */
export function DoneScene({ entity, days }: { entity: EntityId; days?: number }) {
  const look = ENTITY_LOOK[entity];
  switch (look.done) {
    case 'sprout': return <Sprout sign={look.sign} hue={look.hue} />;
    case 'pebble_laid': return <ScenePebbleLaid hue={look.hue} />;
    case 'breath_rest': return <SceneBreath phase="rest" hue={look.hue} />;
    case 'check_in': return <SceneCheckIn hue={look.hue} days={days ?? 1} />;
    default: return null;
  }
}
