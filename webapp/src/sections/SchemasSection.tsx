import { useState, lazy, Suspense } from 'react';
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

const ModeEx = lazy(() => import('../components/exercises/FlashcardEx').then(m => ({ default: m.ModeEx })));

interface Props {
  onOpenSchema: (opts?: { startTest?: boolean; tab?: 'needs'|'schemas'|'modes'; highlight?: string }) => void;
  childhoodRatings?: Record<string, number>;
  onOpenChildhoodWheel?: () => void;
}

export function SchemasSection({ onOpenSchema, childhoodRatings = {}, onOpenChildhoodWheel }: Props) {
  const d = useSchemasData();
  const [showSchemaPicker, setShowSchemaPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [introModeId, setIntroModeId] = useState<string | null>(null);
  const [detailSchemaId, setDetailSchemaId] = useState<string | null>(null);
  const [detailNeedId, setDetailNeedId] = useState<string | null>(null);
  const [showMyMap, setShowMyMap] = useState(false);

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

      <MySchemasBlock loading={d.loading} ids={allSchemaIds} onAdd={() => setShowSchemaPicker(true)} onOpenSchema={setDetailSchemaId} />
      <SchemaMap mineIds={allSchemaIds} onOpenSchema={setDetailSchemaId} />
      <ModesBlocks loading={d.loading} myModeIds={d.myModeIds} onAdd={() => setShowModePicker(true)} onOpenMode={setIntroModeId} />
      {d.myMapCount > 0 && <ModeMapBanner count={d.myMapCount} onOpen={() => setShowMyMap(true)} />}
      <NeedsBlock childhoodRatings={childhoodRatings} onOpenChildhoodWheel={onOpenChildhoodWheel} onOpenNeed={setDetailNeedId} />

      {showSchemaPicker && (
        <SchemaPickerSheet selected={d.manualSchemaIds} onSave={d.saveSchemas} onClose={() => setShowSchemaPicker(false)} />
      )}
      {showModePicker && (
        <ModePickerSheet selected={d.myModeIds} onSave={d.saveModes} onClose={() => setShowModePicker(false)} />
      )}
      {introModeId && (
        <div className="u-sheet">
          <Suspense fallback={null}><ModeEx onBack={() => setIntroModeId(null)} initialModeId={introModeId} /></Suspense>
        </div>
      )}
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
