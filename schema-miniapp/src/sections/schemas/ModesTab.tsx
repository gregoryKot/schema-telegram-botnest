import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ModesHero } from '../../components/ModesHero';
import { ModesPatternSection } from './ModesPatternSection';
import { WeekTopSummary } from '../../utils/patternsSummary';
import { SchemasSectionProps } from './types';
import type { ModeDiaryEntry } from '../../types';

interface ModesTabProps {
  profileLoading: boolean;
  myModeIds: string[];
  modeSummary: WeekTopSummary | null;
  modeFreq: Record<string, number>;
  modeEntries: ModeDiaryEntry[];
  setModeEntries: Dispatch<SetStateAction<ModeDiaryEntry[]>>;
  onOpenSchema: SchemasSectionProps['onOpenSchema'];
  onOpenDiaries?: () => void;
  onShowModePicker: () => void;
  onMeetCritic: () => void;
}

export function ModesTab({
  profileLoading,
  myModeIds,
  modeSummary,
  modeFreq,
  modeEntries,
  setModeEntries,
  onOpenSchema,
  onOpenDiaries,
  onShowModePicker,
  onMeetCritic,
}: ModesTabProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      {/* Hero: новичку — знакомство с Критиком; опытному — «чаще всего включается» */}
      {!profileLoading && (
        <ModesHero
          hasModes={myModeIds.length > 0}
          summary={modeSummary}
          onMeetCritic={onMeetCritic}
          onOpenLibrary={() => onOpenSchema({ tab: 'modes' })}
          onPickManually={onShowModePicker}
          onOpenModeDetail={setOpenId}
          onOpenDiaries={onOpenDiaries}
        />
      )}

      <ModesPatternSection
        profileLoading={profileLoading}
        myModeIds={myModeIds}
        modeFreq={modeFreq}
        modeEntries={modeEntries}
        setModeEntries={setModeEntries}
        modeSummary={modeSummary}
        onShowModePicker={onShowModePicker}
        openId={openId}
        onOpenChange={setOpenId}
      />
    </>
  );
}
