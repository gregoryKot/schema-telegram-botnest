// Рисунки знаков листов подсказок (ключи — GUIDE_SIGNS, guideSignsModel.ts): часть реестра
// SignArt.tsx, вынесенная отдельно, чтобы GuideSignArt — он живёт в главном чанке кабинета —
// не тянул туда весь реестр (домены, знаки приложения, сцены). Одна таблица на оба входа:
// SignArt собирает свой реестр из неё, а не повторяет её. Отдельный .ts: модуль компонентов
// экспортирует только компоненты (react-refresh/only-export-components).
import type { ReactElement } from 'react';
import type { ArtProps } from './paper';
import type { GuideSign } from './guideSignsModel';
import { Attachment, Expression, Limits } from './NeedArt';
import { Breath, Cup, Layers, Pebbles, Ribbon, Sheets, Strokes } from './PaperArt';
import { Beads, Check, Cluster, Heart, Leaf, Talk, Wheel } from './PaperArtSigns';
import { ChildCare, Looming, Shelter, Shield, Together, Yield } from './GuideSignsModes';
import {
  Flashcard, Grown, HeartFrame, Horizon, PatternSteps, Rescript, Scales, Spotlight, TalkPast,
} from './GuideSignsTechniques';
import { Chatter, Flare } from './GuideSignsPractice';
import { Grounded, Haven, Join, Pause } from './AppSigns';
import { CopingAvoidance, CopingOvercompensation, CopingSurrender } from './CopingSigns';
import { Roots } from './GuideSignsYoung';
import { PATH_SIGN_ART } from './pathSignDrawings';
import { TECHNIQUE_OWN_SIGN_ART } from './techniqueOwnSignDrawings';

export const GUIDE_SIGN_ART: Record<GuideSign, (p: ArtProps) => ReactElement> = {
  child_care: ChildCare,
  yield: Yield,
  shelter: Shelter,
  shield: Shield,
  looming: Looming,
  together: Together,
  cluster: Cluster,
  pattern_steps: PatternSteps,
  rescript: Rescript,
  horizon: Horizon,
  talk: Talk,
  talk_past: TalkPast,
  flashcard: Flashcard,
  sheets: Sheets,
  breath: Breath,
  heart_frame: HeartFrame,
  scales: Scales,
  spotlight: Spotlight,
  heart: Heart,
  grown: Grown,
  pebbles: Pebbles,
  ribbon: Ribbon,
  chatter: Chatter,
  check: Check,
  layers: Layers,
  beads: Beads,
  limits: Limits,
  flare: Flare,
  cup: Cup,
  join: Join,
  pause: Pause, haven: Haven, leaf: Leaf, roots: Roots, strokes: Strokes, grounded: Grounded, wheel: Wheel,
  coping_avoidance: CopingAvoidance, coping_overcompensation: CopingOvercompensation, need_attachment: Attachment, coping_surrender: CopingSurrender, need_expression: Expression,
  ...TECHNIQUE_OWN_SIGN_ART,
  ...PATH_SIGN_ART,
};
