import { useEffect, useState } from 'react';
import { useTr } from '../utils/addressForm';
import { api } from '../api';
import { BottomSheet } from './BottomSheet';
import {
  CHILDHOOD_DONE_KEY,
  shouldShowChildhoodWheel,
  type ActiveSchema,
  type NeedId,
  type Phase,
  type Ratings,
} from './childhoodWheelSheet/types';
import { buildNeedMeta } from './childhoodWheelSheet/needMeta';
import { IntroPhase } from './childhoodWheelSheet/IntroPhase';
import { FillPhase } from './childhoodWheelSheet/FillPhase';
import { ResultPhaseGate } from './childhoodWheelSheet/ResultPhaseGate';
import { SchemaDescSheet } from './childhoodWheelSheet/SchemaDescSheet';

export { CHILDHOOD_DONE_KEY, shouldShowChildhoodWheel };

interface Props {
  onClose: () => void;
  onOpenSchemas: () => void;
  onSaved?: (ratings: Record<string, number>) => void;
}

export function ChildhoodWheelSheet({
  onClose,
  onOpenSchemas,
  onSaved,
}: Props) {
  const tr = useTr();
  const NEED_META = buildNeedMeta(tr);
  const alreadyDone = !!localStorage.getItem(CHILDHOOD_DONE_KEY);
  const [phase, setPhase] = useState<Phase>(alreadyDone ? 'result' : 'intro');
  const [activeSchema, setActiveSchema] = useState<ActiveSchema | null>(null);
  const [ratings, setRatings] = useState<Ratings>({
    attachment: 5,
    autonomy: 5,
    expression: 5,
    play: 5,
    limits: 5,
  });
  const [saving, setSaving] = useState(false);
  const [openExampleId, setOpenExampleId] = useState<NeedId | null>(null);
  const [openExampleIdx, setOpenExampleIdx] = useState<number | null>(null);
  const [result, setResult] = useState({ loaded: !alreadyDone, error: false });

  useEffect(() => {
    if (!alreadyDone) return;
    api
      .getChildhoodRatings()
      .then((saved) => {
        setRatings((prev) => ({ ...prev, ...(saved as Ratings) }));
        setResult({ loaded: true, error: false });
      })
      .catch(() => setResult({ loaded: true, error: true }));
  }, []);

  function handleSave() {
    if (saving) return;
    setSaving(true);
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    onSaved?.(ratings);
    setPhase('result');
    setSaving(false);
    api
      .saveChildhoodRatings(ratings as Record<string, number>)
      .catch((e) => console.error('saveChildhoodRatings failed', e));
  }

  function finish() {
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    onClose();
  }

  return (
    <>
      <BottomSheet onClose={finish} zIndex={200}>
        {/* ── INTRO ── */}
        {phase === 'intro' && (
          <IntroPhase onStart={() => setPhase('fill')} onSkip={finish} />
        )}

        {/* ── FILL ── */}
        {phase === 'fill' && (
          <FillPhase
            NEED_META={NEED_META}
            ratings={ratings}
            setRatings={setRatings}
            openExampleId={openExampleId}
            setOpenExampleId={setOpenExampleId}
            openExampleIdx={openExampleIdx}
            setOpenExampleIdx={setOpenExampleIdx}
            saving={saving}
            onSave={handleSave}
          />
        )}

        {/* ── RESULT ── */}
        {phase === 'result' && (
          <ResultPhaseGate
            loaded={result.loaded}
            loadError={result.error}
            NEED_META={NEED_META}
            ratings={ratings}
            onEdit={() => setPhase('fill')}
            onDone={finish}
            onOpenSchemas={onOpenSchemas}
            setActiveSchema={setActiveSchema}
          />
        )}
      </BottomSheet>

      {activeSchema && (
        <SchemaDescSheet
          activeSchema={activeSchema}
          onClose={() => setActiveSchema(null)}
        />
      )}
    </>
  );
}
