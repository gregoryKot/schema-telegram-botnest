// Рисунки знаков техник, добавленных после первых 14 (ключи — TECHNIQUE_OWN_SIGN_KEYS);
// часть таблицы guideSignDrawings.ts. Отдельный .ts: модуль компонентов экспортирует только компоненты.
import type { ReactElement } from 'react';
import type { TechniqueOwnSign } from '../../../../shared/src/theme/techniqueSignKeys';
import type { ArtProps } from './paper';
import {
  Ambivalence, Attune, Courtroom, Keepsake, SceneLook, Socratic, TalkInner, TalkNow, TalkSchema, TalkScreen,
  ThreeChairs, WarmSelf,
} from './TechniqueSignsScenes';
import {
  Activation, Approach, Defusion, DiarySheet, LevelsHeart, LifeLine, PebbleBowl, Pie, Rewind, ToleranceWindow,
  TryStep, Values,
} from './TechniqueSignsSteps';
import { CopingBypass, GuessMode, ModeFigures, NeedCycle, Scatter } from './TechniqueSignsArntz';
import { ModePlan, ParentVoice, PlanAhead, SafetyBubble, StormNeed } from './TechniqueSignsFarrell';
import {
  CriticMask, IfThen, IntimacyDialogue, ProbePhrase, RecentScene, ThreeParts, TraumaMap,
} from './TechniqueSignsHeath';
import { BalanceAxes, BodyModePositions, Genogram, StandAbove } from './TechniqueSignsRoediger';
import { FingerPuppets, InnerHouse } from './TechniqueSignsLuz';
import { BodyScan, BreathingSpace, HealthyLight, SchemaLens } from './TechniqueSignsVreeswijk';
import { LifeColumns, RuptureMend } from './TechniqueSignsRafaeli';
import * as couples from './TechniqueSignsCouples';
import { ModePage, MonitorRing, ReviewRows } from './TechniqueSignsFarrellShaw';

export const TECHNIQUE_OWN_SIGN_ART: Record<TechniqueOwnSign, (p: ArtProps) => ReactElement> = {
  scene_look: SceneLook, talk_inner: TalkInner, talk_screen: TalkScreen, talk_schema: TalkSchema,
  talk_now: TalkNow, three_chairs: ThreeChairs, ambivalence: Ambivalence, courtroom: Courtroom,
  socratic: Socratic, attune: Attune, keepsake: Keepsake, warm_self: WarmSelf,
  diary_sheet: DiarySheet, pebble_bowl: PebbleBowl, try_step: TryStep, activation: Activation,
  approach: Approach, values: Values, life_line: LifeLine, window: ToleranceWindow,
  levels_heart: LevelsHeart, defusion: Defusion, pie: Pie, rewind: Rewind,
  scatter: Scatter, need_ring: NeedCycle, guess_mode: GuessMode, bypass: CopingBypass, figures: ModeFigures,
  mode_plan: ModePlan, plan_ahead: PlanAhead, bubble: SafetyBubble, parent_voice: ParentVoice,
  storm_need: StormNeed, mask: CriticMask,
  probe: ProbePhrase, intimacy: IntimacyDialogue, three_parts: ThreeParts,
  trauma_lines: TraumaMap, recent_scene: RecentScene, if_then: IfThen, family_tree: Genogram,
  finger_puppets: FingerPuppets, house_floors: InnerHouse, stand_above: StandAbove, balance_axes: BalanceAxes, side_seat: BodyModePositions,
  breathing_space: BreathingSpace, body_scan: BodyScan, schema_lens: SchemaLens,
  healthy_light: HealthyLight,
  rupture_mend: RuptureMend, life_columns: LifeColumns,
  need_wish: couples.NeedWish, mutual_hold: couples.MutualHold,
  friend_pair: couples.FriendPair, couple_chairs: couples.CoupleChairs,
  monitor_ring: MonitorRing, mode_page: ModePage, review_rows: ReviewRows,
};
