// Hero вкладки «Режимы» — скрываемый через useScreenBlocks('patterns', …)
// под тем же id 'heroes', что PatternsHero на вкладке «Схемы» (один тумблер
// «Подсказка сверху» на обе вкладки). Долгое нажатие подсвечивает строку в
// ScreenCustomizeSheet. Вынесено из ModesTab.tsx (файл-храповик у потолка,
// правило №10 CLAUDE.md).
import { ModesHero } from '../../components/ModesHero';
import { SchemasSectionProps } from './types';
import { WeekTopSummary } from '../../utils/patternsSummary';
import type { BlockVisibility } from './blockVisibility';

interface Props {
  profileLoading: boolean;
  hasModes: boolean;
  summary: WeekTopSummary | null;
  onMeetCritic: () => void;
  onOpenSchema: SchemasSectionProps['onOpenSchema'];
  onShowModePicker: () => void;
  onOpenModeDetail: (id: string) => void;
  onOpenDiaries?: () => void;
  blocks: BlockVisibility;
}

export function ModesHeroSection({
  profileLoading,
  hasModes,
  summary,
  onMeetCritic,
  onOpenSchema,
  onShowModePicker,
  onOpenModeDetail,
  onOpenDiaries,
  blocks,
}: Props) {
  if (profileLoading || blocks.isHidden('heroes')) return null;
  return (
    <div data-testid="hold-heroes" {...blocks.holdProps('heroes')}>
      <ModesHero
        hasModes={hasModes}
        summary={summary}
        onMeetCritic={onMeetCritic}
        onOpenLibrary={() => onOpenSchema({ tab: 'modes' })}
        onPickManually={onShowModePicker}
        onOpenModeDetail={onOpenModeDetail}
        onOpenDiaries={onOpenDiaries}
      />
    </div>
  );
}
