// Подвал завершённой быстрой практики «Здесь и сейчас»: счётчик прохождений +
// кнопка «Поделиться». Общий для трёх практик (правило «одна механика — один
// компонент») — QuickPracticeFlow кладёт его в doneExtra пошагового листа,
// BreathingCard показывает под карточкой (у дыхания нет done-экрана).
// Вёрстка — два представления (PracticeDoneFooterApp / ...Site), токены
// объявлены в обоих index.css (гейт check-token-contract.mjs).
import { useEffect } from 'react';
import { pluralRu } from '../utils/pluralRu';
import { PracticeDoneFooterApp } from './PracticeDoneFooterApp';
import { PracticeDoneFooterSite } from './PracticeDoneFooterSite';

/** Подпись для canvas-карточки и шаринга — без формы обращения и рода. */
export function practiceCountLabel(count: number | null): string | null {
  if (count == null || count <= 0) return null;
  return `прошли ${count} ${pluralRu(count, 'раз', 'раза', 'раз')}`;
}

interface Props {
  count: number | null;
  onShare: () => void;
  /** Зовётся один раз при показе — record прохождения (read-after-write). */
  onShown?: () => void;
  /** 'app' — плашка по центру (мини-апп); 'site' — editorial сайта. */
  variant?: 'app' | 'site';
}

export function PracticeDoneFooter({
  count,
  onShare,
  onShown,
  variant = 'app',
}: Props) {
  useEffect(() => {
    // Записываем прохождение ровно один раз при появлении подвала —
    // повторные маунты в рамках открытой практики гасит сам useQuickPractice.
    onShown?.();
  }, [onShown]);

  if (variant === 'site')
    return <PracticeDoneFooterSite count={count} onShare={onShare} />;
  return <PracticeDoneFooterApp count={count} onShare={onShare} />;
}
