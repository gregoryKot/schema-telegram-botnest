import { useEffect, useState } from 'react';
import { useIsMobile } from '../components/useIsMobile';
import { SchemaPickerSheet } from '../components/SchemaPickerSheet';
import { ModePickerSheet } from '../components/ModePickerSheet';
import { SchemaDetailSheet } from '../components/SchemaDetailSheet';
import { NeedDetailSheet } from '../components/NeedDetailSheet';
import '../styles/client-schemas.css';
import { useSchemasData } from './schemas/useSchemasData';
import { SelectionSaveNote } from './schemas/SelectionSaveNote';
import { PatternsModesPane } from './schemas/PatternsModesPane';
import { ModeMapBanner, MyModeMapSheet } from './schemas/ModeMapBanner';
import { NeedsBlock } from './schemas/NeedsBlock';
import { usePatternLayer } from './schemas/usePatternLayer';
import { PatternsTopCards } from './schemas/PatternsTopCards';
import { PatternsTopStack } from './schemas/PatternsTopStack';
import { ModesTopCards } from './schemas/ModesTopCards';
import { INTRO_MODE_ID } from '../../../shared/src/pattern/weekPatternText';
import { ScreenCustomizeHost } from '../components/customize/ScreenCustomizeHost';
import { useScreenBlocks } from '../components/customize/useScreenBlocks';
import { PatternsSchemasPane } from './schemas/PatternsSchemasPane';
import { PatternsHeader } from './schemas/PatternsHeader';
import { PatternsTabsBar } from './schemas/PatternsTabsBar';
import { readStoredTab, visibleBlocks, writeStoredTab } from './schemas/patternsTab';

interface Props {
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes'; highlight?: string }) => void;
  childhoodRatings?: Record<string, number>;
  onOpenChildhoodWheel?: () => void;
}

export function SchemasSection({ onOpenSchema, childhoodRatings = {}, onOpenChildhoodWheel }: Props) {
  const d = useSchemasData();
  const blocks = useScreenBlocks('patterns');
  const [showSchemaPicker, setShowSchemaPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [detailSchemaId, setDetailSchemaId] = useState<string | null>(null);
  const [detailNeedId, setDetailNeedId] = useState<string | null>(null);
  const [showMyMap, setShowMyMap] = useState(false);
  const pat = usePatternLayer();
  const mobile = useIsMobile();
  const [tab, setTab] = useState(readStoredTab);
  useEffect(() => { writeStoredTab(tab); }, [tab]);
  const show = visibleBlocks(tab, mobile);
  const startTest = () => onOpenSchema({ startTest: true });

  const allSchemaIds = [...new Set([...d.ysqSchemaIds, ...d.manualSchemaIds])];

  return (
    <div className="ds-page cs-page">
      <PatternsHeader mobile={mobile} onOpenLibrary={() => onOpenSchema()} onCustomize={blocks.openByGear} />
      {mobile && <PatternsTabsBar tab={tab} onChange={setTab} />}
      <SelectionSaveNote failed={d.saveFailed} blocked={d.saveBlocked} />

      {show.hero && (
        <PatternsTopStack
          blocks={blocks} mobile={mobile} ysqProgressAnswered={d.ysqProgressAnswered} ysqCompletedAt={d.ysqCompletedAt} onStartTest={startTest}
          hero={
            <PatternsTopCards
              blocks={blocks} ready={!d.loading && pat.entriesReady} hasSchemas={allSchemaIds.length > 0} hasModes={d.myModeIds.length > 0}
              hasEntries={pat.hasEntries} top={pat.top} testProgress={d.ysqProgressAnswered}
              onOpenPattern={pat.openPattern} onOpenModeEx={pat.openModeEx} onStartTest={startTest}
            />
          }
        />
      )}

      {show.schemas && (
        <PatternsSchemasPane
          mobile={mobile} d={d} pat={pat} allSchemaIds={allSchemaIds}
          onStartTest={startTest} onAdd={() => setShowSchemaPicker(true)} onOpenDetail={setDetailSchemaId} blocks={blocks}
        />
      )}
      {show.modesHero && (
        <ModesTopCards
          blocks={blocks} ready={!d.loading && pat.entriesReady} hasModes={d.myModeIds.length > 0} summary={pat.modeTop}
          onMeetCritic={() => pat.openModeEx(INTRO_MODE_ID)} onOpenLibrary={() => onOpenSchema({ tab: 'modes' })}
          onPickManually={() => setShowModePicker(true)} onOpenMode={(id) => pat.openPattern('mode', id)}
        />
      )}
      {show.modes && (
        <PatternsModesPane
          mobile={mobile} d={d} pat={pat} onAdd={() => setShowModePicker(true)}
          banner={d.myMapCount > 0 ? <ModeMapBanner count={d.myMapCount} onOpen={() => setShowMyMap(true)} /> : undefined}
        />
      )}
      {show.needs && <NeedsBlock childhoodRatings={childhoodRatings} onOpenChildhoodWheel={onOpenChildhoodWheel} onOpenNeed={setDetailNeedId} />}

      {showSchemaPicker && (
        <SchemaPickerSheet selected={d.manualSchemaIds} onSave={d.saveSchemas} onClose={() => setShowSchemaPicker(false)} />
      )}
      {showModePicker && (
        <ModePickerSheet selected={d.myModeIds} onSave={d.saveModes} onClose={() => setShowModePicker(false)} />
      )}
      {pat.layer}
      {detailSchemaId && <SchemaDetailSheet schemaId={detailSchemaId} onClose={() => setDetailSchemaId(null)} />}
      {detailNeedId && (
        <NeedDetailSheet
          needId={detailNeedId}
          childhoodRating={childhoodRatings[detailNeedId]}
          activeSchemaIds={allSchemaIds}
          onClose={() => setDetailNeedId(null)}
        />
      )}
      {showMyMap && <MyModeMapSheet onClose={() => setShowMyMap(false)} />}
      <ScreenCustomizeHost blocks={blocks} />
    </div>
  );
}
