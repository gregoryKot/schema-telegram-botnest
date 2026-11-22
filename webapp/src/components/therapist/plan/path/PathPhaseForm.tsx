import { useId, useState } from 'react';
import { LimitedInput, LimitedTextarea } from '../../../../../../shared/src/components/LimitedTextarea';
import {
  PATH_PHASE_GOAL_MAX, PATH_PHASE_NAME_MAX, PATH_PHASE_WEEKS_MAX, type PathPhaseDraft,
} from '../../../../../../shared/src/therapy/path/pathModel';
import { cleanText } from '../planModel';
import { parseWeeks } from './pathView';

interface Props {
  /** Правка фазы; без него — новая фаза. */
  initial?: Pick<PathPhaseDraft, 'name' | 'goal' | 'weeks'>;
  busy: boolean;
  /** true — сохранено, форма закрывается; отказ виден строкой ленты. */
  onSave: (draft: Pick<PathPhaseDraft, 'name' | 'goal' | 'weeks'>) => Promise<boolean>;
  onClose: () => void;
}

/** Название, цель и срок фазы. Даты следующих фаз пересчитываются от сроков сами. */
export function PathPhaseForm({ initial, busy, onSave, onClose }: Props) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [goal, setGoal] = useState(initial?.goal ?? '');
  const [weeks, setWeeks] = useState(String(initial?.weeks ?? 4));
  const cleanName = cleanText(name);
  const parsed = parseWeeks(weeks);
  const save = () => {
    if (!cleanName || parsed == null) return;
    void onSave({ name: cleanName, goal: cleanText(goal), weeks: parsed }).then((ok) => { if (ok) onClose(); });
  };
  return (
    <div className="ph-form">
      <div className="ph-field">
        <label className="ds-label" htmlFor={`${id}-name`}>Название</label>
        <LimitedInput id={`${id}-name`} max={PATH_PHASE_NAME_MAX} className="ds-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="ph-field">
        <label className="ds-label" htmlFor={`${id}-goal`}>Цель</label>
        <LimitedTextarea id={`${id}-goal`} max={PATH_PHASE_GOAL_MAX} className="ds-textarea" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </div>
      <label className="ph-field ph-field--weeks">
        <span className="ds-label">Срок, недель</span>
        <input type="number" inputMode="numeric" min={1} max={PATH_PHASE_WEEKS_MAX} className="ds-input" value={weeks} onChange={(e) => setWeeks(e.target.value)} />
      </label>
      <div className="tb-actions">
        <button type="button" className="ds-btn ds-btn--sm" disabled={!cleanName || parsed == null || busy} aria-busy={busy || undefined} onClick={save}>Сохранить</button>
        <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={onClose}>Отмена</button>
      </div>
    </div>
  );
}
