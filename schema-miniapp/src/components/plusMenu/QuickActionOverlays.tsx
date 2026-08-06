// Рендер оверлея действия, открытого из «плюса» (кроме дневниковых карточек
// и трекера — теми управляет AppDiaryNav напрямую). Switch с exhaustiveness-
// check (never в default): новое действие без ветки здесь не скомпилируется —
// правило «одна механика — один компонент»/принуждение через тип.
import { QuickPracticeSheet } from '../QuickPracticeSheet';
import { BeliefCheck } from '../BeliefCheck';
import { PhraseCheck } from '../PhraseCheck';
import { SafePlace } from '../SafePlace';
import { LetterToSelf } from '../LetterToSelf';
import { SchemaFlashcard } from '../SchemaFlashcard';
import { WarmWords } from '../WarmWords';

export type OverlayQuickActionId =
  | 'breathing'
  | 'grounding'
  | 'stop'
  | 'belief_check'
  | 'phrase_check'
  | 'flashcard'
  | 'safe_place'
  | 'letter_to_self'
  | 'warm_words';

interface Props {
  active: OverlayQuickActionId | null;
  onClose: () => void;
  onOpenTracker: () => void;
}

export function QuickActionOverlays({ active, onClose, onOpenTracker }: Props) {
  if (active === null) return null;

  switch (active) {
    case 'breathing':
    case 'grounding':
    case 'stop':
      return <QuickPracticeSheet id={active} onClose={onClose} />;
    case 'belief_check':
      return <BeliefCheck onClose={onClose} />;
    case 'phrase_check':
      return <PhraseCheck onClose={onClose} />;
    case 'safe_place':
      return <SafePlace onClose={onClose} />;
    case 'letter_to_self':
      return <LetterToSelf onClose={onClose} />;
    case 'flashcard':
      return (
        <SchemaFlashcard onClose={onClose} onOpenTracker={onOpenTracker} />
      );
    case 'warm_words':
      return <WarmWords onClose={onClose} />;
    default: {
      const _exhaustive: never = active;
      return _exhaustive;
    }
  }
}
