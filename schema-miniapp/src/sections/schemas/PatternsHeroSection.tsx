// Hero + карточка теста YSQ вкладки «Схемы», оба скрываемые+переставляемые
// через useScreenBlocks('patterns', …) — heroes/ysq_status, порядок стопки —
// blocks.orderedIds. Вынесено из SchemasTab.tsx (файл-храповик у потолка).
import { Fragment, type ReactNode } from 'react';
import { PatternsHero } from '../../components/PatternsHero';
import { YsqStatusCard } from './YsqStatusCard';
import { SchemasSectionProps } from './types';
import { WeekTopSummary } from '../../utils/patternsSummary';
import type { ScreenBlockId } from '../../utils/screenBlocks';
import type { BlockVisibility } from './blockVisibility';

interface Props {
  profileLoading: boolean;
  hasSchemas: boolean;
  weekSummary: WeekTopSummary | null;
  ysqProgressAnswered: number | null;
  ysqCompletedAt: string | null;
  onOpenSchema: SchemasSectionProps['onOpenSchema'];
  onShowSchemaPicker: () => void;
  onOpenSchemaDetail: (id: string) => void;
  onOpenDiaries?: () => void;
  blocks: BlockVisibility;
}

export function PatternsHeroSection({
  profileLoading,
  hasSchemas,
  weekSummary,
  ysqProgressAnswered,
  ysqCompletedAt,
  onOpenSchema,
  onShowSchemaPicker,
  onOpenSchemaDetail,
  onOpenDiaries,
  blocks,
}: Props) {
  const cardsById: Partial<Record<ScreenBlockId, ReactNode>> = {
    heroes: !profileLoading && !blocks.isHidden('heroes') && (
      <div data-testid="hold-heroes" {...blocks.holdProps('heroes')}>
        <PatternsHero
          hasSchemas={hasSchemas}
          summary={weekSummary}
          progressAnswered={ysqProgressAnswered}
          onStartTest={() => onOpenSchema({ startTest: true })}
          onOpenLibrary={() => onOpenSchema()}
          onPickManually={onShowSchemaPicker}
          onOpenSchemaDetail={onOpenSchemaDetail}
          onOpenDiaries={onOpenDiaries}
        />
      </div>
    ),
    ysq_status: hasSchemas && !blocks.isHidden('ysq_status') && (
      <div data-testid="hold-ysq_status" {...blocks.holdProps('ysq_status')}>
        <YsqStatusCard
          ysqCompletedAt={ysqCompletedAt}
          ysqProgressAnswered={ysqProgressAnswered}
          onOpenSchema={onOpenSchema}
        />
      </div>
    ),
  };
  return blocks.orderedIds.map((id) => (
    <Fragment key={id}>{cardsById[id]}</Fragment>
  ));
}
