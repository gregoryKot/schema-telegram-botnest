import { useState } from 'react';
import { api, type PracticePlan } from '../api';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { needLook } from '../../../shared/src/theme/entityLook';
import type { NeedId } from '../../../shared/src/needs/types';
import { glueSpaces } from '../../../shared/src/utils/typo';
import '../styles/sheet-tracker.css';
import { BottomSheetShell } from './BottomSheetShell';
import { EntitySheet } from './paper/EntitySheet';
import { GlyphCheck } from './exercises/ExGlyphs';

interface Props {
  plan: PracticePlan;
  needLabel: string;
  onDone: () => void;
}

// «Вчера в планах было» (b20): шапка — лист потребности плана (бумага NEED_HUE + NeedArt вместо точки-квадратика),
// сам шаг — Literata без коробки с цветной полосой, две равные кнопки, «Да, получилось» — залитая с галочкой-SVG.
export function CheckInSheet({ plan, needLabel, onDone }: Props) {
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
        <EntitySheet look={needLook(plan.needId as NeedId)} label={needLabel} compact
          title={tr('Вчера в планах было', 'Вчера вы планировали')} className="tk2-ci-q" />

        <p className="tk2-ci-plan">{glueSpaces(plan.practiceText)}</p>

        <div className="tk2-ci-ask">
          Получилось?
        </div>

        <div className="tk2-ci-btns">
          <button onClick={() => checkin(false)} disabled={saving} className="ds-btn ds-btn--secondary">
            Не вышло
          </button>
          <button onClick={() => checkin(true)} disabled={saving} className="ds-btn">
            {saving ? 'Сохранение…' : <>Да, получилось <GlyphCheck /></>}
          </button>
        </div>
        {error && (
          <div className="tk2-ci-err" role="alert">
            {tr(
              'Не удалось сохранить – попробуй ещё раз',
              'Не удалось сохранить – попробуйте ещё раз',
            )}
          </div>
        )}
        <button onClick={goBack} disabled={saving} className="ds-link pa-quiet tk2-ci-skip">
          Пропустить
        </button>
    </BottomSheetShell>
  );
}
