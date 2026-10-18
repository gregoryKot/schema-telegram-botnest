import { useNavigate } from 'react-router-dom';
import { INTRO_MODE_ID } from '../../../../shared/src/pattern/weekPatternText';
import type { WeekPatternTop } from '../../../../shared/src/pattern/patternsSummary';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';
import { WeekPatternCard } from './WeekPatternCard';
import { PatternsIntro } from './PatternsIntro';
import { introStep } from './introStep';

interface Props {
  /** Профиль ещё грузится или записи дневника не пришли — ничего не рисуем. */
  ready: boolean;
  hasSchemas: boolean;
  hasModes: boolean;
  hasEntries: boolean;
  top: WeekPatternTop | null;
  testProgress: number | null;
  onOpenPattern: (kind: MyCardsKind, id: string) => void;
  onOpenModeEx: (id: string) => void;
  onStartTest: () => void;
}

/**
 * Верх экрана «Мои паттерны»: есть запись за неделю — «паттерн недели»;
 * нет — вводная новичку с одним главным действием (тест / режим / дневник).
 */
export function PatternsTopCards({ ready, hasSchemas, hasModes, hasEntries, top, testProgress, onOpenPattern, onOpenModeEx, onStartTest }: Props) {
  const navigate = useNavigate();
  if (!ready) return null;
  if (top) return <WeekPatternCard top={top} onOpen={onOpenPattern} />;
  const step = introStep(hasSchemas, hasModes);
  if (step === 'diary' && hasEntries) return null;
  const act = step === 'schemas' ? onStartTest : step === 'modes' ? () => onOpenModeEx(INTRO_MODE_ID) : () => navigate('/diary');
  return <PatternsIntro step={step} testProgress={testProgress} onAction={act} />;
}
