import '../../styles/client-practice.css';
import { pressable } from '../../utils/a11y';

export const HERE_BLOCK_ID = 'practice-here-and-now';
export const HELP_BLOCK_ID = 'practice-help-nearby';

function scrollToBlock(id: string) {
  document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

/** Верхний ряд «Практики»: «Мне плохо» (флешкарта) и переходы к блокам помощи ниже.
 * Без onCrisis (пункт «Схема включилась» скрыт в «Инструментах») карточки нет. */
export function PracticeTopRow({ onCrisis }: { onCrisis?: () => void }) {
  return (
    <div className="cp-top">
      {onCrisis && (
        <div className="ds-card ds-card--crisis ds-card--hover cp-top-card" {...pressable(onCrisis)}>
          <div className="ds-h3">Мне плохо</div>
          <div className="ds-sub">Пять шагов: разобраться что происходит, успокоиться</div>
          <div className="ds-link cp-top-go">Начать →</div>
        </div>
      )}
      <div className="ds-card ds-card--hover cp-top-card" {...pressable(() => scrollToBlock(HERE_BLOCK_ID))}>
        <div className="ds-label">Здесь и сейчас</div>
        <div className="cp-top-line">Дыхание 4-4-6</div>
        <div className="cp-top-line">Заземление 5-4-3-2-1</div>
        <div className="cp-top-line">Техника «Стоп»</div>
      </div>
      <div className="ds-card ds-card--hover cp-top-card" {...pressable(() => scrollToBlock(HELP_BLOCK_ID))}>
        <div className="ds-label">Помощь рядом</div>
        <div className="cp-top-text">Если есть угроза жизни — 112. Телефон доверия и кризисные контакты — ниже.</div>
      </div>
    </div>
  );
}
