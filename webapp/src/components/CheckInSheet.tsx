import { useState } from 'react';
import { api, type PracticePlan } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { NEED_HUE, hueStyle } from '../lib/tone';
import type { NeedId } from '../../../shared/src/needs/types';
import '../styles/sheet-tracker.css';
import { BottomSheetShell } from './BottomSheetShell';

interface Props {
  plan: PracticePlan;
  needColor: string;
  needLabel: string;
  color: string;
  onDone: () => void;
}

export function CheckInSheet({ plan, needLabel, onDone }: Props) {
  const hue = NEED_HUE[plan.needId as NeedId];
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
        <div className="tk2-ci-q" style={hueStyle(hue)}>
          <div className="ds-h2">
            {tr('Вчера в планах было', 'Вчера вы планировали')}
          </div>
          <div className="tk2-ci-need">
            <span className="ds-dot tone-fill" /> {needLabel}
          </div>
        </div>

        <div className="ds-card ds-card--row tk2-ci-plan" style={hueStyle(hue)}>
          {plan.practiceText}
        </div>

        <div className="tk2-ci-ask">
          Получилось?
        </div>

        <div className="tk2-ci-btns">
          <button onClick={() => checkin(false)} disabled={saving} className="ds-btn ds-btn--secondary">
            Не вышло
          </button>
          <button onClick={() => checkin(true)} disabled={saving} className="ds-btn">
            {saving ? 'Сохранение...' : 'Да, получилось ✓'}
          </button>
        </div>
        {error && (
          <div className="tk2-ci-err">
            {tr(
              'Не удалось сохранить – попробуй ещё раз',
              'Не удалось сохранить – попробуйте ещё раз',
            )}
          </div>
        )}
        <button onClick={goBack} disabled={saving} className="ds-link tk2-ci-skip">
          Пропустить
        </button>
    </BottomSheetShell>
  );
}
