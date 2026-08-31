// Рендер оверлея действия, открытого из «плюса» (кроме дневниковых карточек,
// трекера и разбора случая — теми управляет AppDiaryNav/sheets напрямую).
// Три экстренные практики (breathing/grounding/stop) — единственное, что
// «плюс» ещё открывает через этот механизм: belief_check/phrase_check/
// flashcard/safe_place/letter_to_self/warm_words переехали в «Инструменты»
// (один дом на действие, utils/quickActionsRegistry.ts) — там их открывает
// HelpOverlays.tsx, не этот компонент. Switch с exhaustiveness-check (never
// в default): новое действие без ветки здесь не скомпилируется — правило
// «одна механика — один компонент»/принуждение через тип.
import { QuickPracticeSheet } from '../QuickPracticeSheet';

export type OverlayQuickActionId = 'breathing' | 'grounding' | 'stop';

interface Props {
  active: OverlayQuickActionId | null;
  onClose: () => void;
}

export function QuickActionOverlays({ active, onClose }: Props) {
  if (active === null) return null;

  switch (active) {
    case 'breathing':
    case 'grounding':
    case 'stop':
      return <QuickPracticeSheet id={active} onClose={onClose} />;
    default: {
      const _exhaustive: never = active;
      return _exhaustive;
    }
  }
}
