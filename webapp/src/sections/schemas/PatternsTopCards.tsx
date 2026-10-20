import { useNavigate } from 'react-router-dom';
import { INTRO_MODE_ID } from '../../../../shared/src/pattern/weekPatternText';
import type { WeekPatternTop } from '../../../../shared/src/pattern/patternsSummary';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';
import { WeekPatternCard } from './WeekPatternCard';
import { PatternsIntro } from './PatternsIntro';
import { introStep } from './introStep';
import { ScreenBlock } from '../../components/customize/ScreenBlock';
import type { SiteScreenBlocks } from '../../components/customize/useScreenBlocks';

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
  /** Скрытие блока «Подсказка сверху» и долгое нажатие («Настроить экран»). */
  blocks: SiteScreenBlocks;
}

/**
 * Верх экрана «Мои паттерны»: есть запись за неделю — «паттерн недели»;
 * нет — вводная новичку с одним главным действием (тест / режим / дневник).
 */
export function PatternsTopCards({ ready, hasSchemas, hasModes, hasEntries, top, testProgress, onOpenPattern, onOpenModeEx, onStartTest, blocks }: Props) {
  const navigate = useNavigate();
  if (!ready) return null;
  const step = introStep(hasSchemas, hasModes);
  if (!top && step === 'diary' && hasEntries) return null;
  const act = step === 'schemas' ? onStartTest : step === 'modes' ? () => onOpenModeEx(INTRO_MODE_ID) : () => navigate('/diary');
  return (
    <ScreenBlock id="heroes" blocks={blocks}>
      {top ? <WeekPatternCard top={top} onOpen={onOpenPattern} /> : <PatternsIntro step={step} testProgress={testProgress} onAction={act} />}
    </ScreenBlock>
  );
}
