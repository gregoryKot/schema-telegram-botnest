import type { CSSProperties } from 'react';
import { SaveStatusLine } from '../../../../../shared/src/therapy/SaveStatusLine';
import { useTr } from '../../../utils/addressForm';
import { ConceptArea } from '../ClientConceptFields';
import type { ClientDetail } from '../clientSheetTypes';
import { SignHead } from '../SignArt';
import '../../../styles/therapist-card.css';

/**
 * Шапка «Плана работы» — цель терапии. Это поле `goals` концептуализации, а не копия: правка идёт тем же
 * `patchConcept` и тем же автосохранением (useConceptAutosave), поэтому видна и в «Концептуализации», и на
 * «Обзоре». Концептуализация не загрузилась — правка закрыта (сбой ≠ пусто), остаётся «Повторить».
 */
export function PlanGoals({ detail }: { detail: ClientDetail }) {
  const tr = useTr();
  const { localConcept, concept, conceptLoad, patchConcept, setClientTab } = detail;
  const goals = (localConcept.goals ?? concept?.goals ?? '') as string;
  return (
    <section className="pp-paper tk-goal pl-goals" style={{ '--h': 70 } as CSSProperties}>
      <div className="ds-head-row">
        <SignHead kind="layers" className="ds-label">Цель терапии</SignHead>
        <SaveStatusLine status={detail.saveStatus} savedAt={detail.savedAt} onRetry={detail.retrySave} errorText={detail.conceptError || undefined} align="right" />
      </div>
      {conceptLoad.failed ? (
        <div className="pl-fail">
          <span className="tb-meta">Цель не загрузилась.</span>
          <button type="button" className="ds-link" disabled={conceptLoad.reloading} onClick={detail.reloadConcept}>Повторить</button>
        </div>
      ) : (
        <ConceptArea
          className="ds-textarea pl-goal-area" rows={2} value={goals} onChange={(v) => patchConcept({ goals: v })}
          placeholder={tr('К чему идёт работа: запиши, что должно измениться', 'К чему идёт работа: запишите, что должно измениться')}
        />
      )}
      <button type="button" className="ds-link" onClick={() => setClientTab('concept')}>Это поле концептуализации — открыть её →</button>
    </section>
  );
}
