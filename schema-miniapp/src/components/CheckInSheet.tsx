import { useState } from 'react';
import { api, PracticePlan } from '../api';
import { BottomSheet } from './BottomSheet';

interface Props {
  plan: PracticePlan;
  needEmoji: string;
  needLabel: string;
  color: string;
  onDone: () => void;
}

export function CheckInSheet({ plan, needEmoji, needLabel, color, onDone }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function checkin(done: boolean) {
    if (saving) return;
    setSaving(true);
    setError(false);
    try {
      await api.checkinPlan(plan.id, done);
      onDone();
    } catch (e) {
      console.error('checkinPlan failed', e);
      setSaving(false);
      setError(true);
    }
  }

  return (
    <BottomSheet onClose={() => {}} zIndex={250}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
          Вчера ты планировал
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 4 }}>
          {needEmoji} {needLabel}
        </div>
      </div>

      <div style={{
        background: color + '18',
        border: `1px solid ${color}33`,
        borderRadius: 14, padding: '16px 18px',
        marginBottom: 28,
        fontSize: 16, color: 'rgba(var(--fg-rgb),0.9)', lineHeight: 1.55,
        textAlign: 'center',
      }}>
        {plan.practiceText}
      </div>

      <div style={{ fontSize: 14, color: 'var(--text-sub)', textAlign: 'center', marginBottom: 16 }}>
        Получилось?
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => checkin(false)}
          disabled={saving}
          style={{
            flex: 1, padding: '15px 0', borderRadius: 14,
            border: '1px solid rgba(var(--fg-rgb),0.1)',
            background: 'rgba(var(--fg-rgb),0.05)',
            color: 'var(--text-sub)', fontSize: 15, cursor: 'pointer',
          }}
        >
          Не вышло
        </button>
        <button
          onClick={() => checkin(true)}
          disabled={saving}
          style={{
            flex: 2, padding: '15px 0', borderRadius: 14, border: 'none',
            background: saving ? 'rgba(var(--fg-rgb),0.1)' : color,
            color: 'var(--text)', fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Сохранение...' : 'Да, сделал ✓'}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--accent-red)', textAlign: 'center' }}>
          Не удалось сохранить — попробуй ещё раз
        </div>
      )}
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        <button
          onClick={onDone}
          disabled={saving}
          style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-faint)', cursor: 'pointer', padding: '4px 12px' }}
        >
          Пропустить
        </button>
      </div>
    </BottomSheet>
  );
}
