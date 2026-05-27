import { useState, useEffect } from 'react';
import { api } from '../api';
import type { PracticePlan } from '../api';
import { Loader } from './Loader';
import { COLORS } from '../types';
import { NEED_DATA } from '../needData';
import { useHistorySheet } from '../hooks/useHistorySheet';

interface Props {
  onClose: () => void;
  onOpenTracker?: () => void;
}

function statusColor(done: boolean | null) {
  if (done === true)  return { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', text: 'var(--accent-green)' };
  if (done === false) return { bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.18)', text: 'var(--accent-red)' };
  return { bg: 'transparent', border: 'var(--line)', text: 'var(--text-sub)' };
}

function statusIcon(done: boolean | null) {
  if (done === true)  return '✅';
  if (done === false) return '❌';
  return '⏳';
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
  const [plans, setPlans] = useState<PracticePlan[] | null>(null);

  useEffect(() => {
    api.getPlanHistory(30).then(setPlans).catch(() => setPlans([]));
  }, []);

  const pending   = (plans ?? []).filter(p => p.done === null);
  const completed = (plans ?? []).filter(p => p.done !== null);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bg)', overflowY: 'auto' }}>
      <div className="page-inner-wide" style={{ paddingTop: 40, paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 36 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--accent)' }}>● </span>Планы
            </div>
            <h1 className="hub-title" style={{ marginBottom: 8 }}>История<br /><span className="it">планов</span></h1>
            {plans !== null && plans.length > 0 && (
              <div className="text-md muted">{pending.length} активных · {completed.length} завершённых</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button onClick={goBack} className="btn btn-secondary">Закрыть</button>
          </div>
        </div>

        <div>
        {!plans ? (
          <Loader minHeight="30vh" />
        ) : plans.length === 0 ? (
          /* Empty state */
          <div style={{ paddingTop: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Планов пока нет
            </div>
            <div style={{
              fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.65,
              marginBottom: 24, maxWidth: 280, margin: '0 auto 24px',
            }}>
              Планы создаются в трекере — выбери потребность с низкой оценкой и нажми «Запланировать практику»
            </div>
            {onOpenTracker && (
              <button onClick={() => { onOpenTracker?.(); goBack(); }} style={{
                padding: '12px 28px', borderRadius: 14, border: 'none', fontFamily: 'inherit',
                background: 'transparent', outline: '1px solid var(--line)',
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
              <div style={{ marginBottom: 24 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  Ожидают выполнения
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pending.map(plan => <PlanCard key={plan.id} plan={plan} onUpdate={setPlans}/>)}
                </div>
              </div>
            )}

            {/* Completed plans */}
            {completed.length > 0 && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 10 }}>
                  Выполненные
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
  const colors     = statusColor(plan.done);
  const needColor  = COLORS[plan.needId] ?? 'var(--accent)';
  const needData   = NEED_DATA[plan.needId];

  function checkin(done: boolean) {
    onUpdate(prev => prev?.map(p => p.id === plan.id ? { ...p, done } : p) ?? null);
    api.checkinPlan(plan.id, done).catch(() => {
      onUpdate(prev => prev?.map(p => p.id === plan.id ? { ...p, done: null } : p) ?? null);
    });
  }

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 20,
      padding: '14px 16px',
      overflow: 'hidden',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {needData && (
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: needColor + '22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12,
            }}>
              {needData.emoji}
            </div>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: needColor }}>
            {needData?.name ?? plan.needId}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {formatDate(plan.scheduledDate)}
          </span>
        </div>
        <span style={{ fontSize: 16 }}>{statusIcon(plan.done)}</span>
      </div>

      {/* Practice text */}
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55, marginBottom: isPending ? 12 : 0 }}>
        {plan.practiceText}
      </div>

      {/* Action buttons for pending */}
      {isPending && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => checkin(true)} style={{
            flex: 1, padding: '9px 0', border: 'none', borderRadius: 12, fontFamily: 'inherit',
            background: 'rgba(52,211,153,0.12)', outline: '1px solid rgba(52,211,153,0.22)',
            color: 'var(--accent-green)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            ✓ Выполнено
          </button>
          <button onClick={() => checkin(false)} style={{
            flex: 1, padding: '9px 0', border: 'none', borderRadius: 12, fontFamily: 'inherit',
            background: 'rgba(248,113,113,0.08)', outline: '1px solid rgba(248,113,113,0.18)',
            color: 'var(--accent-red)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            Не вышло
          </button>
        </div>
      )}
    </div>
  );
}
