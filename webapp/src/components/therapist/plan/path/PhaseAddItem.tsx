import { useState } from 'react';
import { PlanItemForm } from '../PlanItemForm';

interface Props {
  busy: boolean;
  /** true — пункт создан, форма закрывается. */
  onAdd: (text: string) => Promise<boolean>;
}

/** Тихая кнопка «+ Свой пункт» внутри фазы; раскрывает ту же форму, что в «По каналам». */
export function PhaseAddItem({ busy, onAdd }: Props) {
  const [adding, setAdding] = useState(false);
  if (adding) return <div className="pl-add ph-add"><PlanItemForm busy={busy} onSave={onAdd} onClose={() => setAdding(false)} /></div>;
  return <button type="button" className="ds-link ph-add-btn" onClick={() => setAdding(true)}>+ Свой пункт</button>;
}
