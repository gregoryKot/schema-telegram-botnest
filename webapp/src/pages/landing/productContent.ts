import type { ReactElement } from 'react';
import type { ArtProps } from '../../components/art/paper';
import { Strokes, Breath, Sheets, Layers } from '../../components/art/PaperArt';
import { Cluster, Talk, Check, Heart, Wheel } from '../../components/art/PaperArtSigns';
import { Limits } from '../../components/art/NeedArt';
import { SceneChildhood, SceneTrigger, SceneNotice } from '../../components/art/LandingScenes';
import { SceneCheckIn } from '../../components/art/LandingScenesMore';
import {
  HOME_STEPS, HOME_FEATURES, HOME_TRUST, HOME_FAQ,
  type HomeStepId, type HomeFeatureId, type HomeTrustId,
} from '../../../../src/articles/home-landing.content';

// Данные продуктового лендинга «Всё по схеме» (.ts — JSX здесь нет, react-refresh).
export const BAND_HUE = { how: 70, app: 240, faq: 135 } as const; // полосы (PaperBand по id) и их плитки меню
type Art = (p: ArtProps) => ReactElement;
// Навбар и мобильное меню; `hue` — бумага плитки меню: у секции с полосой — её, соседи по сетке
// 2×3 разные. `Art` — знак секции в углу плитки меню (по «Мотив → смысл»: колесо — шаг 01,
// полоски — трекер, слои — тест, листы — написанное, реплики — вопрос-ответ); у «Приложения»
// знака нет — там сам значок продукта (BrandMark), его и ставят на экран.
export const NAV_LINKS: { label: string; href: string; hue: number; Art?: Art }[] = [
  { label: 'Как это работает', href: '#how', hue: BAND_HUE.how, Art: Wheel },
  { label: 'Возможности', href: '#features', hue: 195, Art: Strokes },
  { label: 'Приложение', href: '#app', hue: BAND_HUE.app },
  { label: 'Тесты', href: '/tests', hue: 45, Art: Layers },
  { label: 'Статьи', href: '#articles', hue: 195, Art: Sheets }, // не 25: рядом с «Тестами» (45) читалось одним розовым
  { label: 'Вопросы', href: '#faq', hue: BAND_HUE.faq, Art: Talk },
];
type Scene = (p: { hue?: number }) => ReactElement;
// Текст — src/articles/home-landing.content.ts (его же сервер вкладывает в #root для
// робота без JS, GEO.md); здесь только вид по `id` — без строки ниже пункт не соберётся
// (tsc). Знак и сцена — по «Мотив → смысл» (docs/design/PAPER_2026-11.md); `hue` — бумага:
// он же уходит в сцену (`<Scene hue>`), источник оттенка один.
const STEP_LOOK: Record<HomeStepId, { num: string; Scene: Scene; hue: number }> = {
  origin:  { num: '01', Scene: SceneChildhood, hue: 45 },  // колесо потребностей вокруг детства
  trigger: { num: '02', Scene: SceneTrigger, hue: 25 },    // лента закрутилась вокруг полоски
  notice:  { num: '03', Scene: SceneNotice, hue: 135 },    // полоска выпрямилась, растёт лист
};
export const STEPS = HOME_STEPS.map((s) => ({ ...s, ...STEP_LOOK[s.id] }));

// Возможности: бенто в 4 колонки, ряды 2+1+1 и 1+1+2 (`wide` — плитка на две колонки).
const FEATURE_LOOK: Record<HomeFeatureId, { Art: Art; hue: number; Scene?: Scene; wide?: boolean }> = {
  diary:     { Art: Strokes, hue: 135, Scene: SceneCheckIn, wide: true }, // чек-ин пяти потребностей = трекер
  schemas:   { Art: Layers, hue: 70 },
  modes:     { Art: Cluster, hue: 25 },  // Cluster крупно: кто сейчас у руля; сланец на розовой бумаге контрастнее, чем на небе
  practices: { Art: Breath, hue: 45 },
  dynamics:  { Art: Sheets, hue: 195 }, // то, что уже собрано
  therapist: { Art: Talk, hue: 240, wide: true },
};
export const FEATURES = HOME_FEATURES.map((f) => ({ ...f, ...FEATURE_LOOK[f.id] }));

// Доверие — плитки цветной бумаги со знаком кабинета (SignScene): персик, небо, шалфей.
const TRUST_LOOK: Record<HomeTrustId, { Art: Art; hue: number }> = {
  free:      { Art: Heart, hue: 45 },   // бережно
  encrypted: { Art: Limits, hue: 240 }, // своя рамка — граница
  leave:     { Art: Check, hue: 135 },  // сделано, без хвостов
};
export const TRUST = HOME_TRUST.map((t) => ({ ...t, ...TRUST_LOOK[t.id] }));
export const FAQ = HOME_FAQ;
