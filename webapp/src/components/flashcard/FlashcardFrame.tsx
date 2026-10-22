import type { ReactNode } from 'react';
import { Topbar } from '../SchemaFlashcardTopbar';

/** Каркас экрана «Мне плохо»: полноэкранный лист, верхняя полоса, колонка контента. */
export function FlashcardFrame({ onBack, label, children, center }: {
  onBack: () => void;
  label: string;
  children: ReactNode;
  center?: boolean;
}) {
  return (
    <div className="u-sheet-grid">
      <Topbar onBack={onBack} label={label} />
      <div className={'sk-fc-body' + (center ? ' is-center' : '')}>{children}</div>
    </div>
  );
}

/** Шапка шага: крупный номер Literata, «Шаг N из 4», заголовок. */
export function FlashcardStepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="sk-fc-head">
      <span className="ds-num sk-fc-num" aria-hidden="true">{n}</span>
      <div>
        <div className="ds-eyebrow">Шаг {n} из 4</div>
        <h1 className="ds-h2 sk-fc-title">{title}</h1>
      </div>
    </div>
  );
}

/** Полоса прогресса по шагам (--accent пройденные). */
export function FlashcardProgress({ total, index }: { total: number; index: number }) {
  return (
    <div className="sk-fc-progress" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < index ? 'is-past' : i === index ? 'is-now' : ''} />
      ))}
    </div>
  );
}
