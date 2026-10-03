import { useCallback } from 'react';
import { api } from '../api';
import type { PracticePlan } from '../api';
import { Loader } from './Loader';
import { COLORS } from '../types';
import { useNeedData } from '../needData';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useAsyncData } from '../hooks/useAsyncData';
import { IdentityDot } from '../../../shared/src/components/IdentityDot';
import { useTr } from '../utils/addressForm';

interface Props {
  onClose: () => void;
  onOpenTracker?: () => void;
}

// Статус плана — цвет значка, а не заливка карточки: на сайте карточка всегда
// бумажная с тонкой рамкой.
function statusColor(done: boolean | null) {
  if (done === true)  return 'var(--accent-green)';
  if (done === false) return 'var(--accent-red)';
  return 'var(--text-sub)';
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

  return (
    <div className="u-sheet">
      <div className="page-inner-wide" style={{ paddingTop: 40, paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36 }}>
          <div>
            <div className="eyebrow u-mb8">
              <span className="u-accent">● </span>Планы
            </div>
            <h1 className="hub-title u-mb8">История<br /><span className="it">планов</span></h1>
            {plans !== null && plans.length > 0 && (
              <div className="text-md muted">{pending.length} активных · {completed.length} завершённых</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-12)', alignItems: 'center' }}>
            <button onClick={goBack} className="btn btn-secondary">Закрыть</button>
          </div>
        </div>

        <div>
        {loadFailed ? (
          // Сбой ≠ пусто: не путать с «Планов пока нет» ниже — там реальный
          // пустой ответ, здесь запрос не прошёл вовсе.
          <div role="alert" style={{ padding: '24px 0' }}>
            <p style={{ color: 'var(--c-rose)', fontSize: 14, margin: '0 0 16px' }}>
              {tr('Не удалось загрузить планы. Проверь соединение', 'Не удалось загрузить планы. Проверьте соединение')}
            </p>
            <button onClick={load} className="btn btn-primary">
              Попробовать ещё раз
            </button>
          </div>
        ) : !plans ? (
          <Loader minHeight="30vh" />
        ) : plans.length === 0 ? (
          /* Empty state: слева, serif-заголовок + подпись + действие-ссылка */
          <div style={{ paddingTop: 40, maxWidth: 420 }}>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.01em', color: 'var(--text)', margin: '0 0 10px' }}>
              Планов пока нет
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.65, margin: '0 0 20px' }}>
              {tr(
                'Планы создаются в трекере — выбери потребность с низкой оценкой и нажми «Запланировать практику»',
                'Планы создаются в трекере — выберите потребность с низкой оценкой и нажмите «Запланировать практику»',
              )}
            </p>
            {onOpenTracker && (
              <button onClick={() => { onOpenTracker?.(); goBack(); }} style={{
                padding: 0, border: 'none', background: 'none', fontFamily: 'inherit',
                color: 'var(--accent)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>
                Открыть трекер →
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Pending plans */}
            {pending.length > 0 && (
              <div className="u-mb24">
                <div className="eyebrow u-mb10">
                  Ожидают выполнения
                </div>
                <div className="u-col10">
                  {pending.map(plan => <PlanCard key={plan.id} plan={plan} onUpdate={setPlans}/>)}
                </div>
              </div>
            )}

            {/* Completed plans */}
            {completed.length > 0 && (
              <div>
                <div className="eyebrow u-mb10">
                  Выполненные
                </div>
                <div className="u-col10">
                  {completed.map(plan => <PlanCard key={plan.id} plan={plan} onUpdate={setPlans}/>)}
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

function PlanCard({ plan, onUpdate }: { plan: PracticePlan; onUpdate: React.Dispatch<React.SetStateAction<PracticePlan[] | null>> }) {
  const isPending  = plan.done === null;
  const needColor  = COLORS[plan.needId] ?? 'var(--accent)';
  const NEED_DATA = useNeedData();
  const needData   = NEED_DATA[plan.needId];

  function checkin(done: boolean) {
    onUpdate(prev => prev?.map(p => p.id === plan.id ? { ...p, done } : p) ?? null);
    api.checkinPlan(plan.id, done).catch(() => {
      onUpdate(prev => prev?.map(p => p.id === plan.id ? { ...p, done: null } : p) ?? null);
    });
  }

  return (
    <div style={{
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-12)',
      padding: '14px 16px',
      overflow: 'hidden',
    }}>
      {/* Top row */}
      <div className="u-between-mb10">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {needData && <IdentityDot id={plan.needId} size={12} />}
          <span style={{ fontSize: 12, fontWeight: 600, color: needColor }}>
            {needData?.name ?? plan.needId}
          </span>
          <span className="u-faint11">·</span>
          <span className="u-faint11">
            {formatDate(plan.scheduledDate)}
          </span>
        </div>
        <span style={{ fontSize: 16, color: statusColor(plan.done) }}>{statusIcon(plan.done)}</span>
      </div>

      {/* Practice text */}
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55, marginBottom: isPending ? 12 : 0 }}>
        {plan.practiceText}
      </div>

      {/* Action buttons for pending */}
      {isPending && (
        <div className="u-row8">
          <button onClick={() => checkin(true)} style={{
            flex: 1, padding: '9px 0', borderRadius: 'var(--r-8)', fontFamily: 'inherit',
            background: 'transparent', border: '1px solid var(--line-strong)',
            color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Выполнено
          </button>
          <button onClick={() => checkin(false)} style={{
            flex: 1, padding: '9px 0', border: 'none', borderRadius: 'var(--r-8)', fontFamily: 'inherit',
            background: 'none', color: 'var(--text-sub)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            Не вышло
          </button>
        </div>
      )}
    </div>
  );
}
