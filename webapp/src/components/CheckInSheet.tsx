import { useState } from 'react';
import { api, type PracticePlan } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { IdentityDot } from '../../../shared/src/components/IdentityDot';
import { BottomSheetShell } from './BottomSheetShell';

interface Props {
  plan: PracticePlan;
  needColor: string;
  needLabel: string;
  color: string;
  onDone: () => void;
}

export function CheckInSheet({ plan, needColor, needLabel, color, onDone }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onDone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function checkin(done: boolean) {
    if (saving) return;
    setSaving(true);
    setError(false);
    try {
      await api.checkinPlan(plan.id, done);
      goBack();
    } catch (e) {
      console.error('checkinPlan failed', e);
      setSaving(false);
      setError(true);
    }
  }

  return (
    // Клик по фону = «Пропустить»; пока идёт сохранение — не закрываем.
    <BottomSheetShell goBack={() => { if (!saving) goBack(); }} zIndex={250}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, color: 'var(--text)', lineHeight: 1.3 }}>
            {tr('Вчера в планах было', 'Вчера вы планировали')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IdentityDot color={needColor} /> {needLabel}
          </div>
        </div>

        <div style={{
          border: '1px solid var(--line)', // цвет потребности — полоской слева, не заливкой
          borderLeft: `3px solid ${color}`,
          borderRadius: 'var(--r-8)', padding: '14px 16px',
          marginBottom: 28,
          fontSize: 16, color: 'var(--text)', lineHeight: 1.55,
        }}>
          {plan.practiceText}
        </div>

        <div style={{ fontSize: 14, color: 'var(--text-sub)', marginBottom: 16 }}>
          Получилось?
        </div>

        <div className="u-row10">
          <button
            onClick={() => checkin(false)}
            disabled={saving}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 'var(--r-8)',
              border: '1px solid var(--line-strong)',
              background: 'transparent',
              color: 'var(--text-sub)', fontSize: 15, cursor: 'pointer',
            }}
          >
            Не вышло
          </button>
          <button
            onClick={() => checkin(true)}
            disabled={saving}
            style={{
              flex: 2, padding: '13px 0', borderRadius: 'var(--r-8)', border: 'none',
              background: 'var(--text)',
              color: 'var(--bg)', fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Сохранение...' : 'Да, получилось ✓'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--accent-red)' }}>
            {tr(
              'Не удалось сохранить – попробуй ещё раз',
              'Не удалось сохранить – попробуйте ещё раз',
            )}
          </div>
        )}
        <div style={{ marginTop: 14 }}>
          <button
            onClick={goBack}
            disabled={saving}
            style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-faint)', cursor: 'pointer', padding: '4px 0' }}
          >
            Пропустить
          </button>
        </div>
    </BottomSheetShell>
  );
}
