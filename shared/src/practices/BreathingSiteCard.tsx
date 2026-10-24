// Дыхание 4-4-6 для сайта: editorial-вёрстка (BreathingSiteView) и подвал сайта
// (PracticeDoneFooterSite) поверх той же рамки (createBreathingCard), что у
// мини-аппа (BreathingCard) — логика одна, вёрстку выбирает площадка импортом.
import { createBreathingCard } from './createBreathingCard';
import { BreathingSiteView } from './BreathingSiteView';
import { PracticeDoneFooterSite } from './PracticeDoneFooterSite';

export const BreathingSiteCard = createBreathingCard(
  BreathingSiteView,
  PracticeDoneFooterSite,
);
