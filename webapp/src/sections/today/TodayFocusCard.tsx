// Фокус-карточка «Сегодня» (сайт). Парный компонент мини-аппа:
// schema-miniapp/src/components/TodayFocusCard.tsx — логика выбора практики и
// тексты общие (shared/today/todayFocus), вёрстка своя (правило №3).
// Одна главная практика с оценкой времени; выполнено — спокойное «на сегодня
// всё» без давления сделать больше.
import { useState, type ReactNode } from 'react';
import { useTr } from '../../utils/addressForm';
import { focusCardContent, type FocusPractice } from '../../../../shared/src/today/todayFocus';
import type { LongPressProps } from '../../../../shared/src/hooks/useLongPress';
import { FocusPicker } from './FocusPicker';

interface Props {
  practice: FocusPractice;
  ratedCount: number;
  total: number;
  /** Средний индекс дня — есть только когда все потребности оценены */
  avgScore: string | null;
  /** Сделана ли сегодня запись выбранной дневниковой практики */
  practiceDoneToday: boolean;
  /** Открыть трекер или форму выбранного дневника */
  onAction: () => void;
  onOpenHistory?: () => void;
  onPick: (p: FocusPractice) => void;
  /** «Поделиться днём» — показывается, когда день оценён */
  shareSlot?: ReactNode;
  /** Долгое нажатие → «Настроить экран» (shared/hooks/useLongPress) */
  hold?: LongPressProps;
}

export function TodayFocusCard({
  practice, ratedCount, total, avgScore, practiceDoneToday, onAction, onOpenHistory, onPick, shareSlot, hold,
}: Props) {
  const tr = useTr();
  const [picking, setPicking] = useState(false);
  const isTracker = practice === 'tracker';
  const content = focusCardContent(practice, ratedCount, total);
  const done = isTracker ? total > 0 && ratedCount === total && !!avgScore : practiceDoneToday;
  const sideAction = isTracker ? onOpenHistory : onAction;

  const picker = (
    <>
      <button type="button" className="ct-focus-switch" aria-expanded={picking} onClick={() => setPicking(p => !p)}>
        {picking ? 'Свернуть' : 'Другая практика'}
      </button>
      {picking && (
        <FocusPicker practice={practice} onPick={p => { onPick(p); setPicking(false); }} />
      )}
    </>
  );

  if (done) {
    return (
      <section {...hold} className="ds-card ct-focus is-done" aria-label="Практика дня">
        <div className="ct-focus-done-row">
          <span className="ct-focus-check" aria-hidden>✓</span>
          <div className="ct-focus-done-text">
            <h3 className="ds-h2">На сегодня – всё</h3>
            <div className="ds-sub">
              {isTracker ? `Индекс дня ${avgScore}/10.` : content.doneSub}{' '}
              {tr('Загляни завтра – или посмотри историю', 'Загляните завтра – или посмотрите историю')}
            </div>
          </div>
          {sideAction && (
            <button type="button" className="ds-link" onClick={sideAction}>
              {isTracker ? 'История →' : 'Ещё →'}
            </button>
          )}
        </div>
        {isTracker && shareSlot && <div className="ct-focus-share">{shareSlot}</div>}
        {picker}
      </section>
    );
  }

  return (
    <section {...hold} className="ds-card ds-card--accent ct-focus" aria-label="Практика дня">
      <div className="ct-focus-head">
        <span className="ds-label ct-on-accent">Одно дело на сегодня</span>
        <span className="ct-focus-chip">{content.chip}</span>
      </div>
      <h3 className="ds-h2 ct-focus-title">{content.title}</h3>
      <div className="ct-focus-sub">{content.sub}</div>
      <button type="button" className="ct-focus-cta" aria-label={`${content.title}. ${content.buttonLabel}`} onClick={onAction}>
        {content.buttonLabel} <span aria-hidden>→</span>
      </button>
      {picker}
    </section>
  );
}
