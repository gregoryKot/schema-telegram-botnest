import { api, PracticePlan } from '../api';
import { COLORS } from '../types';
import { useNeedData } from '../needData';

// Карточка одного плана — вынесено из PlansScreen.tsx (правило №10, файл был
// над потолком в 300 строк). Самодостаточна: сама делает чек-ин с
// оптимистичным обновлением и откатом при сбое api.checkinPlan.
function statusColor(done: boolean | null) {
  if (done === true)
    return {
      bg: 'color-mix(in srgb, var(--accent-green) 8%, transparent)',
      border: 'color-mix(in srgb, var(--accent-green) 20%, transparent)',
      text: 'var(--accent-green)',
    };
  if (done === false)
    return {
      bg: 'color-mix(in srgb, var(--accent-red) 7%, transparent)',
      border: 'color-mix(in srgb, var(--accent-red) 18%, transparent)',
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

/** Кнопка отметки плана. Две кнопки различались только цветом и насыщенностью
 *  текста — остальные 9 свойств совпадали дословно (правило «одна механика —
 *  один компонент» CLAUDE.md). */
function CheckinButton({
  onClick,
  bg,
  line,
  color,
  weight,
  label,
}: {
  onClick: () => void;
  bg: string;
  line: string;
  color: string;
  weight: number;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '9px 0',
        border: 'none',
        borderRadius: 'var(--r-12)',
        fontFamily: 'inherit',
        background: bg,
        outline: `1px solid ${line}`,
        color,
        fontSize: 13,
        fontWeight: weight,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
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
      <div className="u-between-mb10">
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: needColor }}>
            {needData?.name ?? plan.needId}
          </span>
          <span className="u-faint11">·</span>
          <span className="u-faint11">{formatDate(plan.scheduledDate)}</span>
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
        <div className="u-row8">
          <CheckinButton
            onClick={() => checkin(true)}
            bg="color-mix(in srgb, var(--accent-green) 12%, transparent)"
            line="color-mix(in srgb, var(--accent-green) 22%, transparent)"
            color="var(--accent-green)"
            weight={600}
            label="✓ Выполнено"
          />
          <CheckinButton
            onClick={() => checkin(false)}
            bg="color-mix(in srgb, var(--accent-red) 8%, transparent)"
            line="color-mix(in srgb, var(--accent-red) 18%, transparent)"
            color="var(--accent-red)"
            weight={500}
            label="Не вышло"
          />
        </div>
      )}
    </div>
  );
}
