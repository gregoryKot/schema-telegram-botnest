import { useState } from 'react';
import { api } from '../../api';
import { ExScreen } from './ExScreen';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { useSavingAction } from '../../hooks/useSavingAction';
import { SchemaDetailSheet } from '../SchemaDetailSheet';
import { PaperAlert } from '../paper/PaperAlert';
import { WheelSkeleton } from './childhoodWheel/WheelSkeleton';
import { useSavedChildhood } from './childhoodWheel/useSavedChildhood';
import { ChildhoodIntro } from './childhoodWheel/ChildhoodIntro';
import { ChildhoodFill } from './childhoodWheel/ChildhoodFill';
import { ChildhoodResult } from './childhoodWheel/ChildhoodResult';
import type { ChildhoodRatings } from '../../../../shared/src/childhoodWheel/childhoodWheel';
import { useChildhoodDraft } from '../../../../shared/src/childhoodWheel/useChildhoodDraft';
import { exerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';
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
  /** «Связать с сегодня» на результате: колесо закрывается своим goBack, затем хост открывает «Историю» трекера. */
  onOpenToday?: () => void;
}

/**
 * Колесо детства. Сначала подтягивает сохранённые ответы: повторное
 * открытие показывает результат с «Изменить», а не пустые пятёрки,
 * которые при сохранении затёрли бы настоящие оценки. Пока ответа нет —
 * лист-герой с местом под сцену и силуэт пяти строк; сбой — PaperAlert с «Повторить».
 */
export function ChildhoodWheelEx({ onBack, onSaved, onOpenSchemas, onOpenToday }: Props) {
  const goBack = useHistorySheet(onBack);
  const { state, retry } = useSavedChildhood();

  if (state.status === 'ready') {
    return <Flow initial={state.ratings} hasSaved={state.hasSaved} goBack={goBack} onSaved={onSaved} onOpenSchemas={onOpenSchemas} onOpenToday={onOpenToday && (() => goBack(onOpenToday))} />;
  }
  const failed = state.status === 'error';
  return (
    <ExScreen
      onBack={goBack} spread look="childhood_wheel" heroArt={failed ? undefined : <span className="chw-scene chw-scene--hero chw-scene--skel" />}
      eyebrow={exerciseCard('wheel').eyebrow} title={TITLE}
    >
      {failed ? <PaperAlert sign="wheel" title="Не удалось загрузить сохранённый результат." onRetry={retry} /> : <WheelSkeleton />}
    </ExScreen>
  );
}

function Flow({ initial, hasSaved, goBack, onSaved, onOpenSchemas, onOpenToday }: Omit<Props, 'onBack'> & {
  initial: ChildhoodRatings;
  hasSaved: boolean;
  goBack: () => void;
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
          onOpenToday={onOpenToday}
        />
      )}
      {schemaId && <SchemaDetailSheet schemaId={schemaId} onClose={() => setSchemaId(null)} />}
    </>
  );
}
