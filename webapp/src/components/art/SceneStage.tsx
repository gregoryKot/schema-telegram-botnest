// SceneStage — «Карта себя» (docs/design/PAPER_2026-11.md, «Сцены»; b09): части выходят на сцену и
// прячутся за кулисами. Пол сцены — линия земли; сверху падуга, по краям — кулисы, листы бумаги; на полу — круги
// частей, которые выходят в трудный момент (цвет — группа режима, размер — сколько раз выходили); за
// кулисами выглядывают бледные круги тех, кто прячется; сверху дуга мха — Здоровый Взрослый держит
// сцену, на ней круги здоровых частей. Всё из данных разборов (selfMapStage.ts): нет меток — пустая
// сцена с одним местом-ожиданием тоном бумаги, без выдуманных кругов. Корни «Откуда тянется» не
// рисуются: у полосы нет своих данных (mapVm.ts), а пустые корни читались бы готовым ответом.
// Каркас — sceneKit (лист-подложка по --h, тень сплошным сдвинутым слоем Lift, холст 320×260).
import type { ReactNode } from 'react';
import type { StageInk, StageModel, StagePart } from '../selfMap/selfMapStage';
import { INK } from './scenePaper';
import { Lift, SceneSvg } from './sceneKit';

const FLOOR = 200;
/** Бледный тон части: затихшая или за кулисами — тот же цвет группы, разбавленный бумагой страницы. */
const pale = (ink: StageInk) => `color-mix(in srgb, ${INK[ink]} 48%, var(--bg))`;
const CURTAIN = 'color-mix(in srgb, var(--c-clay) 46%, var(--bg))';

/** Центры кругов на полу: чем больше частей, тем теснее, и тем меньше потолок радиуса. */
const STAGE_X: Record<number, readonly number[]> = { 1: [160], 2: [130, 190], 3: [112, 160, 208], 4: [103, 144, 185, 226] };
const STAGE_R_MAX = [28, 28, 23, 19];
/** Места за кулисами: из-за кромки кулисы под падугой (ниже — пол занят теми, кто на сцене), потом ниже. */
const WINGS_SLOTS = [{ x: 82, y: 84 }, { x: 238, y: 84 }, { x: 80, y: 142 }, { x: 240, y: 142 }] as const;
/** Дуга мха над сценой и места здоровых частей на ней. */
const ARC = 'M86 128 Q160 52 234 128';
/** Верх дуги: посередине и над соседними местами (точки кривой ARC). */
const ARC_TOP = { 160: 90, 134: 95, 186: 95 } as Record<number, number>;
const HOLD_X: Record<number, readonly number[]> = { 1: [160], 2: [134, 186] };

function Part({ p, cx, cy, r, zone }: { p: StagePart; cx: number; cy: number; r: number; zone: string }) {
  return <circle data-part={zone} data-mode={p.modeId} cx={cx} cy={cy} r={r} fill={p.dormant || zone === 'backstage' ? pale(p.ink) : INK[p.ink]} />;
}

export function SceneStage({ model, hue = 240, className }: { model: StageModel; hue?: number; className?: string }) {
  const n = model.stage.length;
  const stage = model.stage.map((p, i) => {
    const r = Math.min(p.r, STAGE_R_MAX[n - 1]);
    return { p, el: <Part key={p.modeId} p={p} cx={STAGE_X[n][i]} cy={FLOOR - r - 3} r={r} zone="stage" /> };
  });
  const lit = (list: typeof stage, dormant: boolean): ReactNode[] => list.filter((s) => s.p.dormant === dormant).map((s) => s.el);
  const hold = model.holding.map((p, i) => {
    const x = HOLD_X[model.holding.length][i];
    const r = Math.min(p.r, 18);
    return <Part key={p.modeId} p={p} cx={x} cy={ARC_TOP[x] - r + 4} r={r} zone="holding" />;
  });
  return (
    <SceneSvg hue={hue} patch={135} patchAt="tr" sheet="c" className={className}>
      {model.backstage.map((p, i) => <Part key={p.modeId} p={p} cx={WINGS_SLOTS[i].x} cy={WINGS_SLOTS[i].y} r={Math.min(p.r, 20)} zone="backstage" />)}
      <Lift>
        <path d={`M34 ${FLOOR} H286`} stroke={INK.sage} strokeWidth="7" strokeLinecap="round" />
        <rect x="34" y="46" width="40" height={FLOOR - 50} rx="8" fill={CURTAIN} transform="rotate(-2 54 120)" />
        <rect x="246" y="46" width="40" height={FLOOR - 50} rx="8" fill={CURTAIN} transform="rotate(2 266 120)" />
        <rect x="28" y="32" width="264" height="22" rx="11" fill={CURTAIN} />
        {hold.length > 0 && <path d={ARC} fill="none" stroke={INK.moss} strokeWidth="12" strokeLinecap="round" />}
        {hold}
        {lit(stage, false)}
      </Lift>
      {lit(stage, true)}
      {n === 0 && hold.length === 0 && model.backstage.length === 0 && (
        <circle data-hollow="" cx="160" cy={FLOOR - 26} r="22" fill={INK.hollow} />
      )}
    </SceneSvg>
  );
}
