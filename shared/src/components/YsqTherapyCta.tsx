import type { CSSProperties, ReactNode } from 'react';
import { ENTITY_LOOK } from '../theme/entityLook';
import type { ContactCta } from '../utils/therapistContact';

interface Props {
  cta: ContactCta;
  /** useTr() вызывающего фронтенда: выбирает вариант обращения по addressForm. */
  tr: (ty: string, vy: string) => string;
  /** Аналитика клика (practice_link_click, place 'ysq_result'). */
  onLinkClick: () => void;
  /** Знак листа (Talk) — рисунок фронтенда. */
  art?: ReactNode;
}

// CTA «разобраться глубже» в результатах теста схем. Общий для обоих
// фронтендов (правило №3); обёртки дают свой useTr и трекинг. Родитель
// уже проверил activeCount > 0 && !cta.isSelf перед рендером.
// Вид (редизайн 2026-11, b16): лист бумаги терапевта (ENTITY_LOOK.therapist, оттенок отсюда же)
// со знаком от экрана (art — рисунок webapp по ENTITY_LOOK.therapist.sign), ссылка —
// второстепенной кнопкой: залитая на экране результата одна, «Сохранить и закрыть».
// Розовая плашка с розовой кнопкой внутри уходит. Классы ss-deep* — schema-library.css.
export function YsqTherapyCta({ cta, tr, onLinkClick, art }: Props) {
  return (
    <div
      className="pp-paper ss-deep"
      style={{ '--h': ENTITY_LOOK.therapist.hue } as CSSProperties}
    >
      {art && (
        <span className="ss-deep-art" aria-hidden="true">
          {art}
        </span>
      )}
      <div className="ss-deep-body">
        <div className="ss-deep-title">
          {tr('Хочешь разобраться глубже?', 'Хотите разобраться глубже?')}
        </div>
        <div className="ss-deep-text">
          Схемы — паттерны, сложившиеся давно. Их можно менять, но это требует
          времени и поддержки. Схема-терапия — один из самых изученных методов
          для этой работы.
        </div>
        <a
          href={cta.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onLinkClick}
          className="ds-btn ds-btn--secondary ss-deep-link"
        >
          {cta.label}
        </a>
      </div>
    </div>
  );
}
