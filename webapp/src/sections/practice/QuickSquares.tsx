// Квадраты «Здесь и сейчас» под героем дыхания — как два квадрата «Сегодня»: заземление, «Стоп» и на
// компьютере «Мне плохо» (на телефоне «Мне плохо» — в листе кризисных строк, PhoneHelpRows). Бумага и
// знак — сущностей ENTITY_LOOK (practiceLook: Grounded, Pause, Heart), внизу мета из данных (useQuickCounts) и стрелка.
// Заменили верхний ряд из трёх плиток, повторявший героя, и строки «Если нужно больше» с одним
// Breath на три разные практики (аудит b14).
import { hueStyle } from '../../lib/tone';
import { glue } from '../../../../shared/src/utils/typo';
import { practiceCountLabel } from '../../../../shared/src/practices/practiceCountLabel';
import { FLASHCARD_SUB, FLASHCARD_TITLE } from '../../../../shared/src/flashcard/flashcardNames';
import { SignHero } from '../../components/paper/SignHero';
import type { QuickCount, QuickCounts } from './useQuickCounts';
import { PRACTICE_LOOK } from './practiceLook';

type QuickId = 'grounding' | 'stop';

const SQUARES: { id: QuickId; title: string; text: string }[] = [
  { id: 'grounding', title: 'Заземление 5-4-3-2-1', text: 'вернуться в тело и в комнату' },
  { id: 'stop', title: 'Техника «Стоп»', text: 'пауза между импульсом и действием' },
];

function Square({ entity, title, text, count, onClick }: { entity: 'grounding' | 'stop' | 'sos'; title: string; text: string; count: QuickCount; onClick: () => void }) {
  const { hue, sign } = PRACTICE_LOOK[entity];
  const meta = count === undefined ? undefined : practiceCountLabel(count);
  return (
    <button type="button" className="pp-paper pp-square cp-sq" style={hueStyle(hue)} onClick={onClick}>
      <span className="pp-title">{glue(title)}</span>
      <span className="pp-text">{glue(text)}</span>
      <span className="cp-sq-art" aria-hidden="true"><SignHero sign={sign} /></span>
      <span className="pp-square-foot">
        {meta === undefined ? <span className="pp-meta pp-meta--skeleton" aria-hidden="true" /> : <span className="pp-meta">{meta && glue(meta)}</span>}
        <span className="pp-arrow" aria-hidden="true">→</span>
      </span>
    </button>
  );
}

/** onSos — квадрат «Мне плохо» (компьютер; нет, если пункт скрыт в «Инструментах»). */
export function QuickSquares({ counts, onOpen, onSos }: { counts: QuickCounts; onOpen: (id: QuickId) => void; onSos?: () => void }) {
  return (
    <div className={'pp-squares cp-squares' + (onSos ? ' cp-squares--3' : '')}>
      {SQUARES.map((s) => <Square key={s.id} entity={s.id} title={s.title} text={s.text} count={counts[s.id]} onClick={() => onOpen(s.id)} />)}
      {onSos && <Square entity="sos" title={FLASHCARD_TITLE} text={FLASHCARD_SUB} count={counts.sos} onClick={onSos} />}
    </div>
  );
}
