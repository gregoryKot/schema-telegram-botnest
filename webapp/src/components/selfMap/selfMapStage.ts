// Данные сцены «Карты себя» (SceneStage, b09): полосы карты (shared/src/map/mapVm.ts) → круги частей.
// Только реальные метки: круг — режим из разборов или карточки примет, размер — по числу случаев,
// цвет — группа режима тем же цветом, что главный элемент знака группы (GuideSignsModes.tsx:
// детские — глина, критики — слива, копинги — сланец, здоровые — мох). Затихший режим гаснет.
// Сцена показывает первые несколько меток полосы (частые и свежие сверху — порядок mapVm);
// полный список с именами — строками под сценой.
import type { MapLane, MapLaneId } from '../../../../shared/src/map/mapVm';

export type StageInk = 'clay' | 'plum' | 'slate' | 'moss';

export interface StagePart {
  modeId: string;
  /** Радиус круга в единицах холста 320×260. */
  r: number;
  ink: StageInk;
  dormant: boolean;
}

export interface StageModel {
  /** Сверху: кто держит (здоровые режимы) — дуга мха и круги на ней. */
  holding: StagePart[];
  /** На сцене: кто выходит в трудный момент. */
  stage: StagePart[];
  /** За кулисами: кто прячется (детские режимы). */
  backstage: StagePart[];
}

/** Сколько кругов помещается в каждой зоне сцены, не налезая друг на друга. */
export const STAGE_MAX: Record<Exclude<MapLaneId, 'origins'>, number> = { healthy: 2, stage: 4, backstage: 4 };

const INK_BY_GROUP: Record<string, StageInk> = {
  child: 'clay',
  critic: 'plum',
  healthy: 'moss',
  coping_surrender: 'slate',
  coping_avoidance: 'slate',
  coping_overcompensation: 'slate',
};

/** Круг тем крупнее, чем чаще режим выходил: 0 случаев (только приметы) — 14, дальше +4 за случай до 30. */
export const partRadius = (count: number): number => 14 + 4 * Math.min(4, Math.max(0, count));

export function buildStage(lanes: MapLane[], groupOf: (modeId: string) => string | undefined): StageModel {
  const zone = (id: Exclude<MapLaneId, 'origins'>): StagePart[] => {
    const lane = lanes.find((l) => l.id === id);
    if (!lane || lane.locked) return [];
    return lane.items.slice(0, STAGE_MAX[id]).map((item) => {
      const group = groupOf(item.modeId);
      return {
        modeId: item.modeId,
        r: partRadius(item.count),
        ink: group !== undefined && Object.hasOwn(INK_BY_GROUP, group) ? INK_BY_GROUP[group] : 'slate',
        dormant: item.dormant,
      };
    });
  };
  return { holding: zone('healthy'), stage: zone('stage'), backstage: zone('backstage') };
}

export const isEmptyStage = (m: StageModel): boolean =>
  m.holding.length + m.stage.length + m.backstage.length === 0;
