import { api, PracticePlan } from '../api';
import { COLORS } from '../types';
import { useNeedData } from '../needData';

// Карточка одного плана — вынесено из PlansScreen.tsx (правило №10, файл был
// над потолком в 300 строк). Самодостаточна: сама делает чек-ин с
// оптимистичным обновлением и откатом при сбое api.checkinPlan.
function statusColor(done: boolean | null) {
  if (done === true)
    return {
      bg: 'rgba(52,211,153,0.08)',
      border: 'rgba(52,211,153,0.2)',
      text: 'var(--accent-green)',
    };
  if (done === false)
    return {
      bg: 'rgba(248,113,113,0.07)',
      border: 'rgba(248,113,113,0.18)',
      text: 'var(--accent-red)',
    };
  return {
    bg: 'var(--surface)',
    border: 'var(--border-color)',
    text: 'var(--text-sub)',
  };
}

function statusIcon(done: boolean | null) {
  if (done === true) return '✓';
  if (done === false) return '×';
  return '·';
}

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Сегодня';
  if (dateStr === tomorrow) return 'Завтра';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function PlanCard({
  plan,
  onUpdate,
}: {
  plan: PracticePlan;
  onUpdate: React.Dispatch<React.SetStateAction<PracticePlan[] | null>>;
}) {
  const isPending = plan.done === null;
  const colors = statusColor(plan.done);
  const needColor = COLORS[plan.needId] ?? 'var(--accent)';
  const NEED_DATA = useNeedData();
  const needData = NEED_DATA[plan.needId];

  function checkin(done: boolean) {
    onUpdate(
      (prev) =>
        prev?.map((p) => (p.id === plan.id ? { ...p, done } : p)) ?? null,
    );
    api.checkinPlan(plan.id, done).catch(() => {
      onUpdate(
        (prev) =>
          prev?.map((p) => (p.id === plan.id ? { ...p, done: null } : p)) ??
          null,
      );
    });
  }

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 'var(--r-20)',
        padding: '14px 16px',
        overflow: 'hidden',
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
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
      <div
        style={{
          fontSize: 14,
          color: 'var(--text)',
          lineHeight: 1.55,
          marginBottom: isPending ? 12 : 0,
        }}
      >
        {plan.practiceText}
      </div>

      {/* Action buttons for pending */}
      {isPending && (
        <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
          <button
            onClick={() => checkin(true)}
            style={{
              flex: 1,
              padding: '9px 0',
              border: 'none',
              borderRadius: 'var(--r-12)',
              fontFamily: 'inherit',
              background: 'rgba(52,211,153,0.12)',
              outline: '1px solid rgba(52,211,153,0.22)',
              color: 'var(--accent-green)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ✓ Выполнено
          </button>
          <button
            onClick={() => checkin(false)}
            style={{
              flex: 1,
              padding: '9px 0',
              border: 'none',
              borderRadius: 'var(--r-12)',
              fontFamily: 'inherit',
              background: 'rgba(248,113,113,0.08)',
              outline: '1px solid rgba(248,113,113,0.18)',
              color: 'var(--accent-red)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Не вышло
          </button>
        </div>
      )}
    </div>
  );
}
