import type { ReactElement } from 'react';
import type { ArtProps } from '../../components/art/paper';
import { Strokes, Ribbon, Breath, Sheets, Layers } from '../../components/art/PaperArt';
import { Cluster, Leaf, Talk, Check, Heart, Wheel } from '../../components/art/PaperArtSigns';
import { Limits } from '../../components/art/NeedArt';
import {
  HOME_STEPS, HOME_FEATURES, HOME_TRUST, HOME_FAQ,
  type HomeStepId, type HomeFeatureId, type HomeTrustId,
} from '../../../../src/articles/home-landing.content';

// Данные продуктового лендинга «Всё по схеме». Non-component модуль (react-refresh;
// .ts — JSX здесь нет): потребители — ProductKit.tsx и ProductLandingPage.tsx.

// Единственный источник для десктоп-навбара и мобильного меню
// (ProductMobileMenu.tsx) — раньше список ссылок жил только инлайном
// в ProductLandingPage, дублировать его во втором месте было бы разъездом.
export const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'Как это работает', href: '#how' },
  { label: 'Возможности', href: '#features' },
  { label: 'Приложение', href: '#app' },
  { label: 'Тесты', href: '/tests' },
  { label: 'Статьи', href: '#articles' },
  { label: 'Вопросы', href: '#faq' },
];

type Art = (p: ArtProps) => ReactElement;
// Текст — src/articles/home-landing.content.ts (его же сервер вкладывает в #root
// для робота без JS, GEO.md); здесь только вид по `id` — без строки ниже пункт
// не соберётся (tsc). Знак — по «Мотив → смысл» (docs/design/PAPER_2026-11.md).
const STEP_LOOK: Record<HomeStepId, { num: string; Art: Art }> = {
  origin:  { num: '01', Art: Wheel },  // потребности вокруг детства
  trigger: { num: '02', Art: Ribbon }, // момент, который зацепил и закрутился
  notice:  { num: '03', Art: Leaf },   // что выросло
};
export const STEPS = HOME_STEPS.map((s) => ({ ...s, ...STEP_LOOK[s.id] }));

const FEATURE_LOOK: Record<HomeFeatureId, { Art: Art }> = {
  diary:     { Art: Strokes }, // чек-ин пяти потребностей = трекер
  schemas:   { Art: Layers },
  modes:     { Art: Cluster },
  practices: { Art: Breath },
  dynamics:  { Art: Sheets },  // то, что уже собрано
  therapist: { Art: Talk },
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
