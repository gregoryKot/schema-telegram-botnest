// Две строки «Если нужно больше», которых на десктопе нет в списке (там они —
// карточки верхнего ряда и отдельный блок «Помощь рядом»): пять шагов
// «Мне плохо» и «Мне очень плохо» с контактами помощи. Контакты раскрываются
// на месте одним касанием (правило №7: кризисный путь не прячется глубже
// одного нажатия), блок «Помощь рядом» тот же, что на десктопе.
import { useState } from 'react';
import { pressable } from '../../utils/a11y';
import { CrisisBlock } from './CrisisBlock';
import { HELP_BLOCK_ID } from './PracticeTopRow';

// Без onSteps (пункт «Схема включилась» скрыт в «Инструментах») строки «Мне плохо» нет;
// «Мне очень плохо» с контактами остаётся всегда.
export function PhoneHelpRows({ onSteps }: { onSteps?: () => void }) {
  const [crisisOpen, setCrisisOpen] = useState(false);
  return (
    <>
      {onSteps && (
        <div className="ds-card ds-card--row ds-card--hover cp-task cp-task--crisis" {...pressable(onSteps)}>
          <div className="cp-task-body">
            <div className="cp-task-title">Мне плохо</div>
            <div className="ds-sub">пять шагов: разобраться и успокоиться</div>
          </div>
          <span className="cp-chev" aria-hidden="true">›</span>
        </div>
      )}
      <div
        className="ds-card ds-card--row ds-card--hover cp-task"
        aria-expanded={crisisOpen}
        {...pressable(() => setCrisisOpen(v => !v))}
      >
        <div className="cp-task-body">
          <div className="cp-task-title cp-task-title--crisis">Мне очень плохо</div>
          <div className="ds-sub">контакты помощи прямо сейчас</div>
        </div>
        <span className={'cp-chev' + (crisisOpen ? ' is-open' : '')} aria-hidden="true">›</span>
      </div>
      {crisisOpen && <div id={HELP_BLOCK_ID}><CrisisBlock /></div>}
    </>
  );
}
