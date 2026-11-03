import { useCallback } from 'react';
import { api } from '../api';
import type { PracticePlan } from '../api';
import { Loader } from './Loader';
import { useNeedData } from '../needData';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useAsyncData } from '../hooks/useAsyncData';
import { NEED_HUE, hueStyle } from '../lib/tone';
import type { NeedId } from '../../../shared/src/needs/types';
import '../styles/sheet-tasks.css';
import { useTr } from '../utils/addressForm';

interface Props {
  onClose: () => void;
  onOpenTracker?: () => void;
}

function statusClass(done: boolean | null) {
  if (done === true)  return 'sk-status is-ok';
  if (done === false) return 'sk-status is-err';
  return 'sk-status';
}

function statusIcon(done: boolean | null) {
  if (done === true)  return '✓';
  if (done === false) return '×';
  return '·';
}

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === today)    return 'Сегодня';
  if (dateStr === tomorrow) return 'Завтра';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function PlansScreen({ onClose, onOpenTracker }: Props) {
  const goBack = useHistorySheet(onClose);
  const tr = useTr();
  // Сбой ≠ пусто (пара к miniapp-фиксу #371): отказ раньше рисовал «Планов
  // пока нет». Здесь — через канонический для webapp useAsyncData.failed.
  const plansFetcher = useCallback(() => api.getPlanHistory(30), []);
  const { data: plans, reload: load, setData: setPlans, failed: loadFailed } =
    useAsyncData<PracticePlan[] | null>(plansFetcher, null);

  const pending   = (plans ?? []).filter(p => p.done === null);
  const completed = (plans ?? []).filter(p => p.done !== null);

  const total = (plans ?? []).length;

  return (
    <div className="u-sheet">
      <div className="sk-page sk-page--wide">
        <div className="ds-head-row sk-head">
          <div>
            <div className="ds-eyebrow">Планы</div>
            <h1 className="ds-h2 sk-title">История<br /><em className="sk-it">планов</em></h1>
            {plans !== null && plans.length > 0 && (
              <div className="ds-sub sk-lead">{pending.length} активных · {completed.length} завершённых</div>
            )}
          </div>
          <button onClick={goBack} className="ds-btn ds-btn--secondary">Закрыть</button>
        </div>

        {plans !== null && total > 0 && (
          <div className="sk-bar" aria-hidden="true">
            <i style={{ width: `${Math.round((completed.length / total) * 100)}%` }} />
          </div>
        )}

        {loadFailed ? (
          // Сбой ≠ пусто: не путать с «Планов пока нет» ниже — там реальный
          // пустой ответ, здесь запрос не прошёл вовсе.
          <div role="alert" className="ds-card sk-alert">
            <p className="sk-error">
              {tr('Не удалось загрузить планы. Проверь соединение', 'Не удалось загрузить планы. Проверьте соединение')}
            </p>
            <button onClick={load} className="ds-btn">
              Попробовать ещё раз
            </button>
          </div>
        ) : !plans ? (
          <Loader minHeight="30vh" />
        ) : plans.length === 0 ? (
          <div className="sk-empty">
            <h2 className="ds-h2">Планов пока нет</h2>
            <p className="ds-sub sk-empty-text">
              {tr(
                'Планы создаются в трекере — выбери потребность с низкой оценкой и нажми «Запланировать практику»',
                'Планы создаются в трекере — выберите потребность с низкой оценкой и нажмите «Запланировать практику»',
              )}
            </p>
            {onOpenTracker && (
              <button onClick={() => goBack(onOpenTracker)} className="ds-link">
                Открыть трекер →
              </button>
            )}
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="sk-group">
                <div className="ds-label">Ожидают выполнения</div>
                <div className="sk-list">
                  {pending.map(plan => <PlanCard key={plan.id} plan={plan} onUpdate={setPlans}/>)}
                </div>
              </div>
            )}

            {completed.length > 0 && (
              <div className="sk-group">
                <div className="ds-label">Выполненные</div>
                <div className="sk-list">
                  {completed.map(plan => <PlanCard key={plan.id} plan={plan} onUpdate={setPlans}/>)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan, onUpdate }: { plan: PracticePlan; onUpdate: React.Dispatch<React.SetStateAction<PracticePlan[] | null>> }) {
  const isPending  = plan.done === null;
  const NEED_DATA = useNeedData();
  const needData   = NEED_DATA[plan.needId];

  function checkin(done: boolean) {
    onUpdate(prev => prev?.map(p => p.id === plan.id ? { ...p, done } : p) ?? null);
    api.checkinPlan(plan.id, done).catch(() => {
      onUpdate(prev => prev?.map(p => p.id === plan.id ? { ...p, done: null } : p) ?? null);
    });
  }

  return (
    <div className="ds-card ds-card--row sk-plan">
      <div className="sk-plan-top">
        <div className="sk-plan-meta">
          {needData && <span className="ds-dot tone-fill" style={hueStyle(NEED_HUE[plan.needId as NeedId])} />}
          <span className="sk-plan-need tone-ink" style={hueStyle(NEED_HUE[plan.needId as NeedId])}>
            {needData?.name ?? plan.needId}
          </span>
          <span className="ds-sub">·</span>
          <span className="ds-sub">{formatDate(plan.scheduledDate)}</span>
        </div>
        <span className={statusClass(plan.done)}>{statusIcon(plan.done)}</span>
      </div>

      <div className="sk-plan-text">{plan.practiceText}</div>

      {isPending && (
        <div className="sk-plan-actions">
          <button onClick={() => checkin(true)} className="ds-btn ds-btn--sm ds-btn--secondary">
            Выполнено
          </button>
          <button onClick={() => checkin(false)} className="ds-btn ds-btn--sm ds-btn--secondary">
            Не вышло
          </button>
        </div>
      )}
    </div>
  );
}
