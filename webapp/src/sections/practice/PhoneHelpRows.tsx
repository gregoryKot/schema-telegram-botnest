// Две строки «Если нужно больше», которых на десктопе нет в списке (там они —
// карточки верхнего ряда и отдельный блок «Помощь рядом»): карточка
// «Мне плохо» и «Мне очень плохо» с контактами помощи. Контакты раскрываются
// на месте одним касанием (правило №7: кризисный путь не прячется глубже
// одного нажатия), блок «Помощь рядом» тот же, что на десктопе.
import { useState } from 'react';
import { pressable } from '../../utils/a11y';
import { Heart } from '../../components/art/PaperArtSigns';
import { CrisisBlock } from './CrisisBlock';
import { HELP_BLOCK_ID } from './PracticeTopRow';
import { FLASHCARD_SUB, FLASHCARD_TITLE } from '../../../../shared/src/flashcard/flashcardNames';

// Без onSteps (пункт «Мне плохо» скрыт в «Инструментах») строки нет; «Мне очень плохо» — всегда.
export function PhoneHelpRows({ onSteps }: { onSteps?: () => void }) {
  const [crisisOpen, setCrisisOpen] = useState(false);
  return (
    <>
      {onSteps && (
        <div className="ds-card ds-card--row ds-card--nav ds-card--crisis ds-card--hover cp-task" {...pressable(onSteps)}><span className="pp-row-art"><Heart size="row" /></span>
          <div className="cp-task-body">
            <div className="ds-list-title">{FLASHCARD_TITLE}</div>
            <div className="ds-sub">{FLASHCARD_SUB}</div>
          </div>
          <span className="ds-chev" aria-hidden="true" />
        </div>
      )}
      <div
        className="ds-card ds-card--row ds-card--nav ds-card--crisis ds-card--hover cp-task"
        aria-expanded={crisisOpen} {...pressable(() => setCrisisOpen(v => !v))}
      ><span className="pp-row-art"><Heart size="row" /></span>
        <div className="cp-task-body">
          <div className="ds-list-title">Мне очень плохо</div>
          <div className="ds-sub">контакты помощи прямо сейчас</div>
        </div>
        <span className="ds-chev" aria-hidden="true" />
      </div>
      {crisisOpen && <div id={HELP_BLOCK_ID}><CrisisBlock /></div>}
    </>
  );
}
