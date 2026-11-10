import { useNavigate } from 'react-router-dom';
import { INTRO_MODE_ID } from '../../../../shared/src/pattern/weekPatternText';
import type { WeekPatternTop } from '../../../../shared/src/pattern/patternsSummary';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';
import { WeekPatternCard } from './WeekPatternCard';
import { PatternsIntro } from './PatternsIntro';
import type { PatternsHero } from './patternsHero';
import { ScreenBlock } from '../../components/customize/ScreenBlock';
import type { SiteScreenBlocks } from '../../components/customize/useScreenBlocks';
import { Skeleton } from '../../components/Skeleton';

interface Props {
  /** Какой герой наверху (patternsHero): пока грузится — силуэт, а не выдуманное состояние. */
  hero: PatternsHero;
  top: WeekPatternTop | null;
  testProgress: number | null;
  onOpenPattern: (kind: MyCardsKind, id: string) => void;
  onOpenModeEx: (id: string) => void;
  onStartTest: () => void;
  /** Скрытие блока «Подсказка сверху» и долгое нажатие («Настроить экран»). */
  blocks: SiteScreenBlocks;
  /** Белый лист с тенью-слоем: сразу под героем — группа «Моих схем» близкой бумаги (patternsTop). */
  white?: boolean;
}

/** Силуэт героя, пока профиль и записи грузятся: лист с местом под знак, а не пустота (принцип 8). */
export function PatternsHeroSkeleton() {
  return (
    <div className="sks-sheet sks-sheet--plain cs-hero-skel" aria-hidden="true">
      <div className="cs-hero-skel-body"><Skeleton width={120} height={11} /><Skeleton width="55%" height={30} /><Skeleton width="80%" height={13} /></div>
      <Skeleton width={88} height={88} radius={44} />
    </div>
  );
}

/**
 * Верх экрана «Мои паттерны»: есть запись за неделю — «паттерн недели»;
 * нет — вводная новичку с одним главным действием (тест / режим / дневник).
 */
export function PatternsTopCards({ hero, top, testProgress, onOpenPattern, onOpenModeEx, onStartTest, blocks, white }: Props) {
  const navigate = useNavigate();
  if (hero.kind === 'loading') return blocks.isHidden('heroes') ? null : <PatternsHeroSkeleton />;
  if (hero.kind === 'none') return null;
  const step = hero.kind === 'intro' ? hero.step : null;
  const act = step === 'schemas' ? onStartTest : step === 'modes' ? () => onOpenModeEx(INTRO_MODE_ID) : () => navigate('/diary');
  return (
    <ScreenBlock id="heroes" blocks={blocks}>
      {step ? <PatternsIntro step={step} testProgress={testProgress} onAction={act} white={white} /> : <WeekPatternCard top={top} onOpen={onOpenPattern} white={white} />}
    </ScreenBlock>
  );
}
