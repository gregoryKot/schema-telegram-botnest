// Квадраты «Здесь и сейчас» под героем дыхания — как два квадрата «Сегодня»: заземление, «Стоп» и на
// компьютере «Мне плохо» (на телефоне «Мне плохо» — в листе кризисных строк, PhoneHelpRows). Бумага и
// знак — сущностей ENTITY_LOOK (practiceLook: Grounded, Pause, Heart), внизу мета из данных (useQuickCounts) и стрелка;
// квадрат — общая плитка QuickTile (у «Что поможет» экрана паттерна — она же без счётчика).
// Заменили верхний ряд из трёх плиток, повторявший героя, и строки «Если нужно больше» с одним
// Breath на три разные практики (аудит b14).
import { practiceCountLabel } from '../../../../shared/src/practices/practiceCountLabel';
import { FLASHCARD_SUB, FLASHCARD_TITLE } from '../../../../shared/src/flashcard/flashcardNames';
import { QuickTile } from '../../components/practice/QuickTile';
import type { QuickCount, QuickCounts } from './useQuickCounts';
import { PRACTICE_LOOK } from './practiceLook';

type QuickId = 'grounding' | 'stop';

const SQUARES: { id: QuickId; title: string; text: string }[] = [
  { id: 'grounding', title: 'Заземление 5-4-3-2-1', text: 'вернуться в тело и в комнату' },
  { id: 'stop', title: 'Техника «Стоп»', text: 'пауза между импульсом и действием' },
];

/** Мета квадрата: undefined — счётчик грузится (скелетон), иначе подпись «прошли N раз» или пусто. */
const meta = (count: QuickCount) => (count === undefined ? undefined : practiceCountLabel(count));

/** onSos — квадрат «Мне плохо» (компьютер; нет, если пункт скрыт в «Инструментах»). */
export function QuickSquares({ counts, onOpen, onSos }: { counts: QuickCounts; onOpen: (id: QuickId) => void; onSos?: () => void }) {
  return (
    <div className={'pp-squares cp-squares' + (onSos ? ' cp-squares--3' : '')}>
      {SQUARES.map((s) => <QuickTile key={s.id} look={PRACTICE_LOOK[s.id]} title={s.title} text={s.text} meta={meta(counts[s.id])} onClick={() => onOpen(s.id)} />)}
      {onSos && <QuickTile look={PRACTICE_LOOK.sos} title={FLASHCARD_TITLE} text={FLASHCARD_SUB} meta={meta(counts.sos)} onClick={onSos} />}
    </div>
  );
}
