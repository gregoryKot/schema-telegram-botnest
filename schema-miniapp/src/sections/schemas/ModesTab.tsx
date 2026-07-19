import { MODE_GROUPS } from '../../schemaTherapyData';
import { ModesHero, INTRO_MODE_ID } from '../../components/ModesHero';
import {
  PatternFrequencyList,
  FreqGroup,
} from '../../components/PatternFrequencyList';
import { WeekTopSummary } from '../../utils/patternsSummary';
import { ChipsSkeleton } from './CatalogParts';
import { SchemasSectionProps } from './types';

interface ModesTabProps {
  profileLoading: boolean;
  myModeIds: string[];
  modeSummary: WeekTopSummary | null;
  modeFreq: Record<string, number>;
  onOpenSchema: SchemasSectionProps['onOpenSchema'];
  onOpenDiaries?: () => void;
  onShowModePicker: () => void;
  onOpenModeIntro: (id: string) => void;
}

export function ModesTab({
  profileLoading,
  myModeIds,
  modeSummary,
  modeFreq,
  onOpenSchema,
  onOpenDiaries,
  onShowModePicker,
  onOpenModeIntro,
}: ModesTabProps) {
  // Режимы пользователя, сгруппированные, с недельной частотой.
  const groups: FreqGroup[] = MODE_GROUPS.map((group) => ({
    title: group.group,
    items: group.items
      .filter((m) => myModeIds.includes(m.id))
      .map((m) => ({
        id: m.id,
        name: `${m.emoji} ${m.name}`,
        freq: modeFreq[m.id] ?? 0,
      })),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {/* Hero: новичку — знакомство с Критиком; опытному — «чаще всего включается» */}
      {!profileLoading && (
        <ModesHero
          hasModes={myModeIds.length > 0}
          summary={modeSummary}
          onMeetCritic={() => onOpenModeIntro(INTRO_MODE_ID)}
          onOpenLibrary={() => onOpenSchema({ tab: 'modes' })}
          onPickManually={onShowModePicker}
          onOpenModeDetail={(id) => onOpenModeIntro(id)}
          onOpenDiaries={onOpenDiaries}
        />
      )}

      {/* Мои режимы по группам с недельной частотой (дизайн-макет «Паттерны») */}
      {myModeIds.length > 0 &&
        (profileLoading ? (
          <ChipsSkeleton widths={[90, 110, 80]} />
        ) : (
          <PatternFrequencyList
            groups={groups}
            selectedId={modeSummary?.id}
            onSelect={onOpenModeIntro}
            addLabel="+ Добавить режим"
            onAdd={onShowModePicker}
            anyFreq={Object.values(modeFreq).some((v) => v > 0)}
            hint="Полоска рядом с режимом — сколько дней за неделю он включался по дневнику. Это наблюдение, а не оценка."
          />
        ))}
    </>
  );
}
