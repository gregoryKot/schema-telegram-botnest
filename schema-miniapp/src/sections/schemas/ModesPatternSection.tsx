// Список «Мои режимы» (частота + статус карточки) и экран паттерна режима —
// вынесено из ModesTab.tsx (файл-храповик у потолка, правило №10 CLAUDE.md).
// openId управляется снаружи: и список, и ModesHero (сводка недели) должны
// открывать один и тот же экран одного и того же режима.
import type { Dispatch, SetStateAction } from 'react';
import { PatternFrequencyList } from '../../components/PatternFrequencyList';
import { PatternSheet } from '../../components/patternSheet/PatternSheet';
import { usePatternStatus } from '../../components/patternSheet/usePatternStatus';
import { modeEntryCounts } from '../../components/patternSheet/patternStatus';
import { PatternListSkeleton } from './CatalogParts';
import { buildModeFreqGroups } from './modeGroups';
import { WeekTopSummary } from '../../utils/patternsSummary';
import type { ModeDiaryEntry } from '../../types';

interface Props {
  profileLoading: boolean;
  myModeIds: string[];
  modeFreq: Record<string, number>;
  modeEntries: ModeDiaryEntry[];
  setModeEntries: Dispatch<SetStateAction<ModeDiaryEntry[]>>;
  modeSummary: WeekTopSummary | null;
  onShowModePicker: () => void;
  openId: string | null;
  onOpenChange: (id: string | null) => void;
}

export function ModesPatternSection({
  profileLoading,
  myModeIds,
  modeFreq,
  modeEntries,
  setModeEntries,
  modeSummary,
  onShowModePicker,
  openId,
  onOpenChange,
}: Props) {
  const { items, reload, statusFor } = usePatternStatus(
    'mode',
    modeEntryCounts(modeEntries),
  );
  const groups = buildModeFreqGroups(myModeIds, modeFreq, statusFor);

  return (
    <>
      {myModeIds.length > 0 &&
        (profileLoading ? (
          <PatternListSkeleton rows={myModeIds.length} />
        ) : (
          <PatternFrequencyList
            groups={groups}
            selectedId={modeSummary?.id}
            onSelect={onOpenChange}
            addLabel="+ Добавить режим"
            onAdd={onShowModePicker}
            anyFreq={Object.values(modeFreq).some((v) => v > 0)}
            hint="Полоска рядом с режимом — сколько дней за неделю он включался по дневнику. Это наблюдение, а не оценка."
          />
        ))}

      {openId && (
        <PatternSheet
          kind="mode"
          id={openId}
          items={items}
          reload={reload}
          modeEntries={modeEntries}
          setModeEntries={setModeEntries}
          onClose={() => onOpenChange(null)}
        />
      )}
    </>
  );
}
