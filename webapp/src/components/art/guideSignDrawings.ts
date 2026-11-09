// Рисунки знаков листов подсказок (ключи — GUIDE_SIGNS, guideSignsModel.ts): часть реестра
// SignArt.tsx, вынесенная отдельно, чтобы GuideSignArt — он живёт в главном чанке кабинета —
// не тянул туда весь реестр (домены, знаки приложения, сцены). Одна таблица на оба входа:
// SignArt собирает свой реестр из неё, а не повторяет её. Отдельный .ts: модуль компонентов
// экспортирует только компоненты (react-refresh/only-export-components).
import type { ReactElement } from 'react';
import type { ArtProps } from './paper';
import type { GuideSign } from './guideSignsModel';
import { Limits } from './NeedArt';
import { Breath, Layers, Pebbles, Ribbon, Sheets } from './PaperArt';
import { Beads, Check, Cluster, Heart, Talk } from './PaperArtSigns';
import { ChildCare, Looming, Shelter, Shield, Together, Yield } from './GuideSignsModes';
import {
  Flashcard, Grown, HeartFrame, Horizon, PatternSteps, Rescript, Scales, Spotlight, TalkPast,
} from './GuideSignsTechniques';
import { Chatter, Flare } from './GuideSignsPractice';

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
};
