import { useCallback } from 'react';
import { api } from '../api';
import type { PracticePlan } from '../api';
import { SkeletonList } from './Skeleton';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useAsyncData } from '../hooks/useAsyncData';
import '../styles/sheet-tasks.css';
import { useTr } from '../utils/addressForm';
import { plansEmptyText, plansSummary } from '../../../shared/src/practices/plansCopy';
import { PlanNeedPicker } from './plans/PlanNeedPicker';
import { PlanCard } from './plans/PlanCard';
import { EntitySheet } from './paper/EntitySheet';
import { PaperAlert } from './paper/PaperAlert';
import { GlyphArrowLeft } from './exercises/ExGlyphs';
import { useNotifyReach } from '../../../shared/src/settings/useNotifyReach';

interface Props {
  onClose: () => void;
  onOpenTracker?: () => void;
}

// «История планов» (b20): шапка — лист плана (шалфей 135 + Check из ENTITY_LOOK) с итогом «1 активный · 3
// завершённых» и полосой мха; пусто — тот же лист «Планов пока нет» и пять плиток потребностей (NeedTiles);
// сбой — наклейка PaperAlert с повтором; строки — PlanCard. «Закрыть» — в полосе листа, а не кнопкой в шапке.
export function PlansScreen({ onClose, onOpenTracker }: Props) {
  const goBack = useHistorySheet(onClose);
  const tr = useTr();
  const notifyReach = useNotifyReach(api.getSettings); // «с напоминанием» — только если дойдёт (U5)
  // Сбой ≠ пусто (пара к miniapp-фиксу #371): отказ раньше рисовал «Планов
  // пока нет». Здесь — через канонический для webapp useAsyncData.failed.
  const plansFetcher = useCallback(() => api.getPlanHistory(30), []);
  const { data: plans, reload: load, setData: setPlans, failed: loadFailed } =
    useAsyncData<PracticePlan[] | null>(plansFetcher, null);

  const pending   = (plans ?? []).filter(p => p.done === null);
  const completed = (plans ?? []).filter(p => p.done !== null);
  const total = (plans ?? []).length;
  const empty = !loadFailed && plans !== null && total === 0;

  const bar = total > 0 && (
    <div className="sk-bar" aria-hidden="true"><i style={{ width: `${Math.round((completed.length / total) * 100)}%` }} /></div>
  );

  return (
    <div className="u-sheet-grid sk-plans-sheet">
      <div className="ds-sheet-head">
        <button type="button" className="ds-back" onClick={goBack}><GlyphArrowLeft /> Закрыть</button>
      </div>
      <div className="sk-scroll">
        <div className="sk-page sk-page--wide">
          {empty ? (
            <EntitySheet look="plan" label="Планы" title="Планов пока нет" titleAs="h1" sub={plansEmptyText(tr, notifyReach)} />
          ) : (
            <EntitySheet look="plan" label="Планы" title="История планов" titleAs="h1"
              sub={total > 0 ? plansSummary(pending.length, completed.length) : undefined} meta={bar || undefined} />
          )}

          {loadFailed ? (
            // Сбой ≠ пусто: не путать с «Планов пока нет» — там реальный пустой ответ, здесь запрос не прошёл вовсе.
            <PaperAlert title={tr('Не удалось загрузить планы. Проверь соединение', 'Не удалось загрузить планы. Проверьте соединение')}
              sign="check" onRetry={load} retryLabel="Попробовать ещё раз" />
          ) : !plans ? (
            <div className="sk-group" aria-hidden><SkeletonList rows={3} height={104} /></div>
          ) : empty ? (
            <div className="sk-group">
              <PlanNeedPicker onPlanned={load} />
              {onOpenTracker && (
                <button onClick={() => goBack(onOpenTracker)} className="ds-link sk-self-start">
                  Открыть трекер →
                </button>
              )}
            </div>
          ) : (
            <>
              {pending.length > 0 && (
                <div className="sk-group">
                  <h2 className="sk-group-title">Ожидают выполнения</h2>
                  <div className="sk-list">
                    {pending.map(plan => <PlanCard key={plan.id} plan={plan} onUpdate={setPlans} />)}
                  </div>
                </div>
              )}
              {completed.length > 0 && (
                <div className="sk-group">
                  <h2 className="sk-group-title">Выполненные</h2>
                  <div className="sk-list">
                    {completed.map(plan => <PlanCard key={plan.id} plan={plan} onUpdate={setPlans} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
