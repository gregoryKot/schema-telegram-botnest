import { useState } from 'react';
import type { PlanItem } from '../../../../../shared/src/therapy/plan/planItem';
import { MMIcon } from '../../modeMapIcons';
import { PlanItemForm } from './PlanItemForm';
import { canAssign, statusLabel } from './planModel';

interface Props {
  item: PlanItem;
  busy: boolean;
  /** Название статьи справочника; null — ссылки нет (пункт свой или статью убрали). */
  sourceTitle: string | null;
  onCycleStatus: () => void;
  onOpenSource: () => void;
  onAssign: () => void;
  onSaveText: (text: string) => Promise<boolean>;
  onDelete: () => void;
}

/** Пункт плана: статус-кнопка (тап — следующий статус), текст, откуда пункт, действия — видны всегда. */
export function PlanItemRow({ item, busy, sourceTitle, onCycleStatus, onOpenSource, onAssign, onSaveText, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const label = statusLabel(item.status);
  return (
    <div className={`pl-item${item.status === 'done' ? ' is-done' : ''}`}>
      <button
        type="button" className={`pl-status pl-status--${item.status}`} disabled={busy}
        aria-label={`Статус: ${label}. Переключить`} onClick={onCycleStatus}
      >
        {label}
      </button>
      <div className="pl-body">
        {editing ? (
          <PlanItemForm initial={item.text} busy={busy} onSave={onSaveText} onClose={() => setEditing(false)} />
        ) : (
          <div className="pl-text">{item.text}</div>
        )}
        {(sourceTitle || item.taskId != null) && (
          <div className="pl-meta">
            {sourceTitle && <button type="button" className="ds-link pl-source" onClick={onOpenSource}>Из справочника: {sourceTitle} →</button>}
            {item.taskId != null && <span className="ds-badge ds-badge--line">выдано заданием</span>}
          </div>
        )}
      </div>
      {!editing && (
        <div className="pl-acts">
          {canAssign(item) && <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary" disabled={busy} onClick={onAssign}>Дать заданием</button>}
          <button type="button" className="ds-btn ds-btn--icon tb-del" aria-label="Изменить текст пункта" disabled={busy} onClick={() => setEditing(true)}><MMIcon name="edit" size={16} /></button>
          <button type="button" className="ds-btn ds-btn--icon tb-del" aria-label="Удалить пункт" disabled={busy} onClick={onDelete}><MMIcon name="trash" size={16} /></button>
        </div>
      )}
    </div>
  );
}
