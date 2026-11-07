import type { CSSProperties } from 'react';
import { INK, VIOLET, PINK, CYAN, AMBER, EMERALD, ROSE, AURORA } from './aurora';
import {
  HOME_STEPS, HOME_FEATURES, HOME_TRUST, HOME_FAQ,
  type HomeStepId, type HomeFeatureId, type HomeTrustId,
} from '../../../../src/articles/home-landing.content';

// Данные и типографика продуктового лендинга «Всё по схеме». Non-component
// модуль (react-refresh; .ts — JSX здесь нет): компоненты-потребители — в ProductKit.tsx и
// ProductLandingPage.tsx. Вынесено из ProductLandingPage при добавлении блока
// об авторе (файловый храповик: раздутый файл дробится, а не пухнет).

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

// Текст лендинга — src/articles/home-landing.content.ts: тот же модуль
// вкладывает его в #root главной для робота без JS (GEO.md). Здесь только вид
// по `id`: новый пункт без строки ниже не соберётся (tsc).
const STEP_LOOK: Record<HomeStepId, { num: string; color: string; emoji: string }> = {
  origin:  { num: '01', color: ROSE,  emoji: '🌱' },
  trigger: { num: '02', color: AMBER, emoji: '🔁' },
  notice:  { num: '03', color: CYAN,  emoji: '👁️' },
};
export const STEPS = HOME_STEPS.map((s) => ({ ...s, ...STEP_LOOK[s.id] }));

const FEATURE_LOOK: Record<HomeFeatureId, { emoji: string; color: string }> = {
  diary:     { emoji: '📓', color: CYAN },
  schemas:   { emoji: '🧩', color: VIOLET },
  modes:     { emoji: '🎭', color: AMBER },
  practices: { emoji: '✍️', color: EMERALD },
  dynamics:  { emoji: '📈', color: PINK },
  therapist: { emoji: '🤝', color: ROSE },
};
export const FEATURES = HOME_FEATURES.map((f) => ({ ...f, ...FEATURE_LOOK[f.id] }));

const TRUST_LOOK: Record<HomeTrustId, { icon: string; color: string }> = {
  free:      { icon: '💛', color: AMBER },
  encrypted: { icon: '🔒', color: CYAN },
  leave:     { icon: '🚪', color: EMERALD },
};
export const TRUST = HOME_TRUST.map((t) => ({ ...t, ...TRUST_LOOK[t.id] }));

export const FAQ = HOME_FAQ;

export const H2: CSSProperties = { fontFamily: 'inherit', fontSize: 'clamp(28px, 3.6vw, 44px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.08, margin: 0, color: INK };
export const EYEBROW: CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', background: AURORA, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };
