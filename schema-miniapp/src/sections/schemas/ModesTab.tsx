import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ModesHeroSection } from './ModesHeroSection';
import { ModesPatternSection } from './ModesPatternSection';
import { WeekTopSummary } from '../../utils/patternsSummary';
import { SchemasSectionProps } from './types';
import type { BlockVisibility } from './blockVisibility';
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
  blocks: BlockVisibility;
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
  blocks,
}: ModesTabProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <ModesHeroSection
        profileLoading={profileLoading}
        hasModes={myModeIds.length > 0}
        summary={modeSummary}
        onMeetCritic={onMeetCritic}
        onOpenSchema={onOpenSchema}
        onShowModePicker={onShowModePicker}
        onOpenModeDetail={setOpenId}
        onOpenDiaries={onOpenDiaries}
        blocks={blocks}
      />
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
