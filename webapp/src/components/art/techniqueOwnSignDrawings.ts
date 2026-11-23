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
import { GuessMode, NeedCycle, Scatter } from './TechniqueSignsArntz';

export const TECHNIQUE_OWN_SIGN_ART: Record<TechniqueOwnSign, (p: ArtProps) => ReactElement> = {
  scene_look: SceneLook, talk_inner: TalkInner, talk_screen: TalkScreen, talk_schema: TalkSchema,
  talk_now: TalkNow, three_chairs: ThreeChairs, ambivalence: Ambivalence, courtroom: Courtroom,
  socratic: Socratic, attune: Attune, keepsake: Keepsake, warm_self: WarmSelf,
  diary_sheet: DiarySheet, pebble_bowl: PebbleBowl, try_step: TryStep, activation: Activation,
  approach: Approach, values: Values, life_line: LifeLine, window: ToleranceWindow,
  levels_heart: LevelsHeart, defusion: Defusion, pie: Pie, rewind: Rewind,
  scatter: Scatter, need_ring: NeedCycle, guess_mode: GuessMode,
};
