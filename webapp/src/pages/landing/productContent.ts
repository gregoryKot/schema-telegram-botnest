import type { ReactElement } from 'react';
import type { ArtProps } from '../../components/art/paper';
import { Strokes, Breath, Sheets, Layers } from '../../components/art/PaperArt';
import { Cluster, Talk, Check, Heart } from '../../components/art/PaperArtSigns';
import { Limits } from '../../components/art/NeedArt';
import { SceneChildhood, SceneTrigger, SceneNotice, SceneTogether } from '../../components/art/LandingScenes';
import { SceneCheckIn } from '../../components/art/LandingScenesMore';
import {
  HOME_STEPS, HOME_FEATURES, HOME_TRUST, HOME_FAQ,
  type HomeStepId, type HomeFeatureId, type HomeTrustId,
} from '../../../../src/articles/home-landing.content';

// Данные продуктового лендинга «Всё по схеме» (.ts — JSX здесь нет, react-refresh).
// Единственный источник для десктоп-навбара и мобильного меню (ProductMobileMenu.tsx).
export const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'Как это работает', href: '#how' },
  { label: 'Возможности', href: '#features' },
  { label: 'Приложение', href: '#app' },
  { label: 'Тесты', href: '/tests' },
  { label: 'Статьи', href: '#articles' },
  { label: 'Вопросы', href: '#faq' },
];

type Art = (p: ArtProps) => ReactElement;
type Scene = (p: { hue?: number }) => ReactElement;
// Текст — src/articles/home-landing.content.ts (его же сервер вкладывает в #root для
// робота без JS, GEO.md); здесь только вид по `id` — без строки ниже пункт не соберётся
// (tsc). Знак и сцена — по «Мотив → смысл» (docs/design/PAPER_2026-11.md); `hue` — бумага.
const STEP_LOOK: Record<HomeStepId, { num: string; Scene: Scene; hue: number }> = {
  origin:  { num: '01', Scene: SceneChildhood, hue: 45 },  // колесо потребностей вокруг детства
  trigger: { num: '02', Scene: SceneTrigger, hue: 25 },    // лента закрутилась вокруг полоски
  notice:  { num: '03', Scene: SceneNotice, hue: 135 },    // полоска выпрямилась, растёт лист
};
export const STEPS = HOME_STEPS.map((s) => ({ ...s, ...STEP_LOOK[s.id] }));

// Возможности: два крупных разворота со сценой (`Scene`) и четыре квадрата цветной бумаги.
const FEATURE_LOOK: Record<HomeFeatureId, { Art: Art; hue: number; Scene?: Scene }> = {
  diary:     { Art: Strokes, hue: 135, Scene: SceneCheckIn }, // чек-ин пяти потребностей = трекер
  schemas:   { Art: Layers, hue: 70 },
  modes:     { Art: Cluster, hue: 45, Scene: SceneTogether }, // Здоровый Взрослый рядом
  practices: { Art: Breath, hue: 240 },
  dynamics:  { Art: Sheets, hue: 300 }, // то, что уже собрано
  therapist: { Art: Talk, hue: 195 },
};
export const FEATURES = HOME_FEATURES.map((f) => ({ ...f, ...FEATURE_LOOK[f.id] }));

// Доверие — квадраты цветной бумаги (оттенок `--h`: персик 45, небо 240, шалфей 135).
const TRUST_LOOK: Record<HomeTrustId, { Art: Art; hue: number }> = {
  free:      { Art: Heart, hue: 45 },   // бережно
  encrypted: { Art: Limits, hue: 240 }, // своя рамка — граница
  leave:     { Art: Check, hue: 135 },  // сделано, без хвостов
};
export const TRUST = HOME_TRUST.map((t) => ({ ...t, ...TRUST_LOOK[t.id] }));
export const FAQ = HOME_FAQ;
