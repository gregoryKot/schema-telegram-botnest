import { useEffect, useRef, useState } from 'react';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { PLAN_ITEM_TEXT_MAX } from '../../../../../shared/src/limits/textLimits';
import { PLAN_RUBRICS, PLAN_RUBRIC_LABEL, type PlanRubric } from '../../../../../shared/src/therapy/plan/planItem';
import { cleanText } from './planModel';

interface Props {
  initial?: string;
  /** Выбор рубрики — только у нового пункта; у правки текста его нет. */
  rubric?: PlanRubric;
  onRubric?: (r: PlanRubric) => void;
  busy: boolean;
  /** true — сохранено, форма закрывается; false — остаётся с текстом (отказ виден строкой вкладки). */
  onSave: (text: string) => Promise<boolean>;
  onClose: () => void;
}

/** Поле пункта плана: новый пункт и правка текста. Пустой текст не сохраняется — кнопка закрыта. */
export function PlanItemForm({ initial = '', rubric, onRubric, busy, onSave, onClose }: Props) {
  const [text, setText] = useState(initial);
  const clean = cleanText(text);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { area.current?.focus(); }, []); // форма открыта кнопкой — курсор сразу в поле
  const save = () => { if (clean) void onSave(clean).then((ok) => { if (ok) onClose(); }); };
  return (
    <div className="pl-form">
      <LimitedTextarea
        max={PLAN_ITEM_TEXT_MAX} className="ds-textarea" rows={3} ref={area} value={text}
        aria-label="Текст пункта" placeholder="Что планируется делать" onChange={(e) => setText(e.target.value)}
      />
      {rubric && onRubric && (
        <label className="pl-form-rubric">
          <span className="tb-meta">Рубрика</span>
          <select className="ds-input ds-input--sm" value={rubric} onChange={(e) => onRubric(e.target.value as PlanRubric)}>
            {PLAN_RUBRICS.map((r) => <option key={r} value={r}>{PLAN_RUBRIC_LABEL[r]}</option>)}
          </select>
        </label>
      )}
      <div className="tb-actions">
        <button type="button" className="ds-btn ds-btn--sm" disabled={!clean || busy} aria-busy={busy || undefined} onClick={save}>Сохранить</button>
        <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" onClick={onClose}>Отмена</button>
      </div>
    </div>
  );
}
