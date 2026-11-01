import { useState } from 'react';
import { api } from '../../api';
import { ExScreen } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useSavingAction } from '../../hooks/useSavingAction';
import { Skeleton } from '../Skeleton';
import { SchemaDetailSheet } from '../SchemaDetailSheet';
import { useSavedChildhood } from './childhoodWheel/useSavedChildhood';
import { ChildhoodIntro } from './childhoodWheel/ChildhoodIntro';
import { ChildhoodFill } from './childhoodWheel/ChildhoodFill';
import { ChildhoodResult } from './childhoodWheel/ChildhoodResult';
import type { ChildhoodRatings } from '../../../../shared/src/childhoodWheel/childhoodWheel';
import { useChildhoodDraft } from '../../../../shared/src/childhoodWheel/useChildhoodDraft';
import '../../styles/sheet-childhood.css';

const TITLE = (
  <>
    Колесо
    <br />
    <span className="it">детства</span>
  </>
);

interface Props {
  onBack: () => void;
  onSaved?: (r: Record<string, number>) => void;
  /** Закрыть колесо и открыть справочник схем (вкладка «Схемы»). */
  onOpenSchemas?: () => void;
}

/**
 * Колесо детства. Сначала подтягивает сохранённые ответы: повторное
 * открытие показывает результат с «✎ Изменить», а не пустые пятёрки,
 * которые при сохранении затёрли бы настоящие оценки.
 */
export function ChildhoodWheelEx({ onBack, onSaved, onOpenSchemas }: Props) {
  const goBack = useHistorySheet(onBack);
  const { state, retry } = useSavedChildhood();

  if (state.status === 'ready') {
    return (
      <Flow
        initial={state.ratings}
        hasSaved={state.hasSaved}
        goBack={goBack}
        onSaved={onSaved}
        onOpenSchemas={onOpenSchemas}
      />
    );
  }
  return (
    <ExScreen onBack={goBack} eyebrow="№ 06 · Истоки" title={TITLE}>
      {state.status === 'error' ? (
        <div role="alert" className="ex2-err">
          Не удалось загрузить сохранённый результат.{' '}
          <button type="button" className="ds-link" onClick={retry}>
            Повторить
          </button>
        </div>
      ) : (
        <div className="cw-skeleton" aria-busy="true">
          <Skeleton height={64} radius={14} />
          <Skeleton height={64} radius={14} />
          <Skeleton height={64} radius={14} />
        </div>
      )}
    </ExScreen>
  );
}

function Flow({ initial, hasSaved, goBack, onSaved, onOpenSchemas }: {
  initial: ChildhoodRatings;
  hasSaved: boolean;
  goBack: () => void;
  onSaved?: (r: Record<string, number>) => void;
  onOpenSchemas?: () => void;
}) {
  const [phase, setPhase] = useState<'intro' | 'fill' | 'result'>(hasSaved ? 'result' : 'intro');
  // Новый человек выставляет каждую потребность сам: пятёрки старта — не ответ.
  const { ratings, unrated, rate, load } = useChildhoodDraft(initial, hasSaved);
  const [saved, setSaved] = useState<ChildhoodRatings | null>(hasSaved ? initial : null);
  const [schemaId, setSchemaId] = useState<string | null>(null);

  // Сбой saveChildhoodRatings не прячем: без индикации и защиты от двойного
  // нажатия человек уходил бы с уверенностью, что колесо сохранено.
  const { saving, error, run, reset } = useSavingAction();
  async function save() {
    if (unrated.length > 0) return;
    const ok = await run(() => api.saveChildhoodRatings(ratings));
    if (ok) {
      setSaved(ratings);
      onSaved?.(ratings);
      setPhase('result');
    }
  }

  function cancelEdit() {
    if (saved) load(saved, true);
    reset();
    setPhase('result');
  }

  return (
    <>
      {phase === 'intro' && (
        <ChildhoodIntro title={TITLE} onBack={goBack} onStart={() => setPhase('fill')} />
      )}
      {phase === 'fill' && (
        <ChildhoodFill
          title={TITLE}
          ratings={ratings}
          unrated={unrated}
          onChange={rate}
          onBack={goBack}
          onCancel={saved ? cancelEdit : undefined}
          onSave={save}
          saving={saving}
          error={error}
        />
      )}
      {phase === 'result' && (
        <ChildhoodResult
          title={TITLE}
          ratings={ratings}
          onBack={goBack}
          onEdit={() => setPhase('fill')}
          onOpenSchema={setSchemaId}
          onOpenSchemas={onOpenSchemas}
        />
      )}
      {schemaId && <SchemaDetailSheet schemaId={schemaId} onClose={() => setSchemaId(null)} />}
    </>
  );
}
