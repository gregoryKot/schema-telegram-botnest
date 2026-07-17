import { useEffect, useState } from 'react';
import { useTr } from '../utils/addressForm';
import { api } from '../api';
import { BottomSheet } from './BottomSheet';
import { NEED_IDS, NeedId, buildNeedMeta } from './childhoodWheelSheet/data';
import { IntroPhase } from './childhoodWheelSheet/IntroPhase';
import { FillPhase } from './childhoodWheelSheet/FillPhase';
import { ResultPhase } from './childhoodWheelSheet/ResultPhase';
import { SchemaDetailSheet } from './childhoodWheelSheet/SchemaDetailSheet';

export const CHILDHOOD_DONE_KEY = 'childhood_wheel_done';

export function shouldShowChildhoodWheel(): boolean {
  return !localStorage.getItem(CHILDHOOD_DONE_KEY);
}

type Phase = 'intro' | 'fill' | 'result';

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
  const [activeSchema, setActiveSchema] = useState<{
    name: string;
    desc: string;
    color: string;
  } | null>(null);
  const [ratings, setRatings] = useState<Record<NeedId, number>>({
    attachment: 5,
    autonomy: 5,
    expression: 5,
    play: 5,
    limits: 5,
  });
  const [saving, setSaving] = useState(false);
  const [openExampleId, setOpenExampleId] = useState<NeedId | null>(null);
  const [openExampleIdx, setOpenExampleIdx] = useState<number | null>(null);

  useEffect(() => {
    if (alreadyDone) {
      api
        .getChildhoodRatings()
        .then((saved) => {
          setRatings((prev) => ({
            ...prev,
            ...(saved as Record<NeedId, number>),
          }));
        })
        .catch(() => {});
    }
  }, []);

  const lowNeeds = NEED_IDS.filter((id) => ratings[id] <= 4);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    // Save locally first so UI never gets stuck
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    onSaved?.(ratings);
    setPhase('result');
    setSaving(false);
    // Sync to server in background
    api.saveChildhoodRatings(ratings as Record<string, number>).catch(() => {});
  }

  function finish() {
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    onClose();
  }

  return (
    <>
      <BottomSheet onClose={finish} zIndex={200}>
        {phase === 'intro' && (
          <IntroPhase
            tr={tr}
            onStart={() => setPhase('fill')}
            onSkip={finish}
          />
        )}

        {phase === 'fill' && (
          <FillPhase
            tr={tr}
            needMeta={NEED_META}
            ratings={ratings}
            setRatings={setRatings}
            saving={saving}
            onSave={handleSave}
            openExampleId={openExampleId}
            setOpenExampleId={setOpenExampleId}
            openExampleIdx={openExampleIdx}
            setOpenExampleIdx={setOpenExampleIdx}
          />
        )}

        {phase === 'result' && (
          <ResultPhase
            tr={tr}
            needMeta={NEED_META}
            ratings={ratings}
            lowNeeds={lowNeeds}
            onEdit={() => setPhase('fill')}
            onFinish={finish}
            onOpenSchemasClick={() => {
              finish();
              onOpenSchemas();
            }}
            onSelectSchema={setActiveSchema}
          />
        )}
      </BottomSheet>

      {activeSchema && (
        <SchemaDetailSheet
          schema={activeSchema}
          onClose={() => setActiveSchema(null)}
        />
      )}
    </>
  );
}
