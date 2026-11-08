import type { ReactElement } from 'react';
import type { ArtProps } from '../../components/art/paper';
import { Strokes, Breath, Sheets, Layers, Pebbles } from '../../components/art/PaperArt';
import { Cluster, Talk, Check, Heart, Wheel } from '../../components/art/PaperArtSigns';
import { Limits } from '../../components/art/NeedArt';
import { SceneChildhood, SceneTrigger, SceneNotice } from '../../components/art/LandingScenes';
import { SceneCheckIn, SceneCoverMini } from '../../components/art/LandingScenesMore';
import {
  HOME_STEPS, HOME_FEATURES, HOME_TRUST, HOME_FAQ,
  type HomeStepId, type HomeFeatureId, type HomeTrustId,
} from '../../../../src/articles/home-landing.content';

// Данные продуктового лендинга «Всё по схеме» (.ts — JSX здесь нет, react-refresh).
export const BAND_HUE = { how: 70, app: 240, faq: 135 } as const; // полосы (PaperBand по id) и их плитки меню
type Art = (p: ArtProps) => ReactElement;
type Scene = (p: { hue?: number }) => ReactElement;
// Навбар и мобильное меню; `hue` — бумага плитки: у секции с полосой — её, соседи в сетках 2×3 и 3×2
// разной бумаги (ProductMobileMenu.test.tsx). `Art` — знак секции, тот же, что на странице («Мотив →
// смысл»); у «Статей» — обложка карточки в миниатюре (`Scene`), у «Приложения» — BrandMark.
export const NAV_LINKS: { label: string; href: string; hue: number; Art?: Art; Scene?: Scene }[] = [
  { label: 'Как это работает', href: '#how', hue: BAND_HUE.how, Art: Wheel },
  { label: 'Возможности', href: '#features', hue: 195, Art: Strokes },
  { label: 'Приложение', href: '#app', hue: BAND_HUE.app },
  { label: 'Тесты', href: '/tests', hue: 25, Art: Layers },
  { label: 'Статьи', href: '#articles', hue: 290, Scene: SceneCoverMini },
  { label: 'Вопросы', href: '#faq', hue: BAND_HUE.faq, Art: Pebbles },
];
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
// Соседи на 4 и 2 колонках и на телефоне, нижний ряд и полоса «Приложения» под ним — разной
// бумаги (сверка — productContent.test.tsx); персика нет: «Режимы» (25) соседи всем.
const FEATURE_LOOK: Record<HomeFeatureId, { Art: Art; hue: number; Scene?: Scene; wide?: boolean }> = {
  diary:     { Art: Strokes, hue: 135, Scene: SceneCheckIn, wide: true }, // чек-ин пяти потребностей = трекер
  schemas:   { Art: Layers, hue: 240 },
  modes:     { Art: Cluster, hue: 25 },  // Cluster крупно: кто сейчас у руля; сланец на розовой бумаге контрастнее, чем на небе
  practices: { Art: Breath, hue: 290 },
  dynamics:  { Art: Sheets, hue: 195 }, // то, что уже собрано
  therapist: { Art: Talk, hue: 70, wide: true }, // солома, а не небо: под плиткой полоса «Приложения»
};
export const FEATURES = HOME_FEATURES.map((f) => ({ ...f, ...FEATURE_LOOK[f.id] }));

// Доверие — плитки цветной бумаги со знаком кабинета (SignScene). Над рядом полоса
// «Приложения» (небо), под ним лист автора (AUTHOR_HUE): ни того, ни другого.
const TRUST_LOOK: Record<HomeTrustId, { Art: Art; hue: number }> = {
  free:      { Art: Heart, hue: 195 },  // бережно
  encrypted: { Art: Limits, hue: 290 }, // своя рамка — граница
  leave:     { Art: Check, hue: 135 },  // сделано, без хвостов
};
export const AUTHOR_HUE = 45; // персик: «Кто это делает»
export const TRUST = HOME_TRUST.map((t) => ({ ...t, ...TRUST_LOOK[t.id] }));
export const FAQ = HOME_FAQ;
