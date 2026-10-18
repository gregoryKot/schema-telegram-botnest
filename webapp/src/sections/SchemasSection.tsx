import { useState } from 'react';
import { SchemaPickerSheet } from '../components/SchemaPickerSheet';
import { ModePickerSheet } from '../components/ModePickerSheet';
import { SchemaDetailSheet } from '../components/SchemaDetailSheet';
import { NeedDetailSheet } from '../components/NeedDetailSheet';
import '../styles/client-schemas.css';
import { useSchemasData } from './schemas/useSchemasData';
import { ExpressedCard } from './schemas/ExpressedCard';
import { YsqTestCard } from './schemas/YsqTestCard';
import { MySchemasBlock } from './schemas/MySchemasBlock';
import { SchemaMap } from './schemas/SchemaMap';
import { ModesBlocks } from './schemas/ModesBlocks';
import { ModeMapBanner, MyModeMapSheet } from './schemas/ModeMapBanner';
import { NeedsBlock } from './schemas/NeedsBlock';
import { usePatternLayer } from './schemas/usePatternLayer';
import { PatternsTopCards } from './schemas/PatternsTopCards';

interface Props {
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes'; highlight?: string }) => void;
  childhoodRatings?: Record<string, number>;
  onOpenChildhoodWheel?: () => void;
}

export function SchemasSection({ onOpenSchema, childhoodRatings = {}, onOpenChildhoodWheel }: Props) {
  const d = useSchemasData();
  const [showSchemaPicker, setShowSchemaPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [detailSchemaId, setDetailSchemaId] = useState<string | null>(null);
  const [detailNeedId, setDetailNeedId] = useState<string | null>(null);
  const [showMyMap, setShowMyMap] = useState(false);
  const pat = usePatternLayer();

  const allSchemaIds = [...new Set([...d.ysqSchemaIds, ...d.manualSchemaIds])];

  return (
    <div className="ds-page cs-page">
      <div className="ds-head-row cs-head">
        <div>
          <div className="ds-eyebrow">Схема-терапия</div>
          <h1 className="ds-h1">Мои <i>паттерны</i></h1>
          <div className="ds-sub cs-head-sub">Схемы, режимы, потребности</div>
        </div>
        <button onClick={() => onOpenSchema()} className="ds-btn ds-btn--secondary">Библиотека</button>
      </div>

      <PatternsTopCards
        ready={!d.loading && pat.entriesReady} hasSchemas={allSchemaIds.length > 0} hasModes={d.myModeIds.length > 0}
        hasEntries={pat.hasEntries} top={pat.top} testProgress={d.ysqProgressAnswered}
        onOpenPattern={pat.openPattern} onOpenModeEx={pat.openModeEx} onStartTest={() => onOpenSchema({ startTest: true })}
      />

      <div className="cs-top">
        <ExpressedCard
          loading={d.loading}
          ysqSchemaIds={d.ysqSchemaIds}
          ysqScores={d.ysqScores}
          completedAt={d.ysqCompletedAt}
          onOpenSchema={setDetailSchemaId}
        />
        <YsqTestCard
          progressAnswered={d.ysqProgressAnswered}
          completedAt={d.ysqCompletedAt}
          onStart={() => onOpenSchema({ startTest: true })}
        />
      </div>

      <MySchemasBlock loading={d.loading} ids={allSchemaIds} onAdd={() => setShowSchemaPicker(true)} onOpenSchema={id => pat.openPattern('schema', id)} statusFor={pat.schemaStatusFor} freq={pat.entriesReady ? pat.schemaFreq : undefined} />
      <SchemaMap mineIds={allSchemaIds} onOpenSchema={setDetailSchemaId} />
      <ModesBlocks loading={d.loading} myModeIds={d.myModeIds} onAdd={() => setShowModePicker(true)} onOpenMode={pat.openModeEx} onOpenPattern={id => pat.openPattern('mode', id)} modeFreq={pat.entriesReady ? pat.modeFreq : undefined} />
      {d.myMapCount > 0 && <ModeMapBanner count={d.myMapCount} onOpen={() => setShowMyMap(true)} />}
      <NeedsBlock childhoodRatings={childhoodRatings} onOpenChildhoodWheel={onOpenChildhoodWheel} onOpenNeed={setDetailNeedId} />

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
    </div>
  );
}
