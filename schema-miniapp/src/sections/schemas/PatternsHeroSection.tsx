// Hero + карточка теста YSQ вкладки «Схемы» — оба скрываемые через
// useScreenBlocks('patterns', …): PatternsHero под id 'heroes' (тот же
// тумблер, что ModesHero на вкладке «Режимы» — один переключатель на обе
// вкладки), YsqStatusCard под 'ysq_status'. Долгое нажатие на блок
// подсвечивает его строку в ScreenCustomizeSheet. Вынесено из SchemasTab.tsx
// (файл-храповик у потолка, правило №10 CLAUDE.md).
import { PatternsHero } from '../../components/PatternsHero';
import { YsqStatusCard } from './YsqStatusCard';
import { SchemasSectionProps } from './types';
import { WeekTopSummary } from '../../utils/patternsSummary';
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
  return (
    <>
      {!profileLoading && !blocks.isHidden('heroes') && (
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
      )}

      {hasSchemas && !blocks.isHidden('ysq_status') && (
        <div data-testid="hold-ysq_status" {...blocks.holdProps('ysq_status')}>
          <YsqStatusCard
            ysqCompletedAt={ysqCompletedAt}
            ysqProgressAnswered={ysqProgressAnswered}
            onOpenSchema={onOpenSchema}
          />
        </div>
      )}
    </>
  );
}
