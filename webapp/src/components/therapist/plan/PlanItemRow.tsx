import { useState } from 'react';
import type { PlanItem, PlanStatus } from '../../../../../shared/src/therapy/plan/planItem';
import { MMIcon } from '../../modeMapIcons';
import { PlanItemForm } from './PlanItemForm';
import type { PlanSourceLink } from './planSource';
import { PhaseMenu, StatusMenu } from './PlanRowMenus';
import { canAssign, type PhaseOption } from './planModel';
import { rowClass, rowDragProps } from './planRowProps';

interface Props {
  item: PlanItem;
  busy: boolean;
  /** Откуда пункт (planSourceLink); null — пункт свой или тексты справочника не приехали. */
  sourceLink: PlanSourceLink | null;
  onSetStatus: (status: PlanStatus) => void;
  onOpenSource: () => void;
  onAssign: () => void;
  /** Задание создано, но отметка в пункте не дошла: вместо «Дать заданием» — повтор отметки. */
  linkPending: boolean;
  onRetryLink: () => void;
  onSaveText: (text: string) => Promise<boolean>;
  onDelete: () => void;
  /** Есть ли сосед в рубрике выше / ниже; оба false — пункт в рубрике один, стрелок нет. */
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: -1 | 1) => void;
  /** Фазы пути: есть — у строки «В фазу…» и перетаскивание; нет (раскладка «По каналам») — ни того, ни другого. */
  phases?: PhaseOption[];
  onSetPhase?: (phaseId: number | null) => void;
}

/** Пункт плана: статус-кнопка (тап — меню из пяти статусов), текст, откуда пункт, действия — видны всегда. */
export function PlanItemRow({ item, busy, sourceLink, onSetStatus, onOpenSource, onAssign, linkPending, onRetryLink, onSaveText, onDelete, canUp, canDown, onMove, phases, onSetPhase }: Props) {
  const [editing, setEditing] = useState(false);
  return (
    <div className={rowClass(item.status)} {...rowDragProps(item.id, !!phases && !editing)}>
      <StatusMenu status={item.status} busy={busy} onPick={onSetStatus} />
      <div className="pl-body">
        {editing ? (
          <PlanItemForm initial={item.text} busy={busy} onSave={onSaveText} onClose={() => setEditing(false)} />
        ) : (
          <div className="pl-text">{item.text}</div>
        )}
        {linkPending && (
          <div className="pl-meta" role="alert">
            <span className="tb-error">Задание создано, но не отметилось в плане</span>
            <button type="button" className="ds-link pl-source" disabled={busy} onClick={onRetryLink}>Повторить</button>
          </div>
        )}
        {(sourceLink || item.taskId != null || (!editing && canAssign(item) && !linkPending)) && (
          <div className="pl-meta">
            {sourceLink?.open && <button type="button" className="ds-link pl-source" onClick={onOpenSource}>Из справочника: {sourceLink.title} →</button>}
            {sourceLink && !sourceLink.open && <span className="ds-sub">Из справочника: {sourceLink.title}{sourceLink.changed && ' · раздел изменился'}</span>}
            {!editing && canAssign(item) && !linkPending && <button type="button" className="ds-link pl-source" disabled={busy} onClick={onAssign}>Дать заданием</button>}
            {item.taskId != null && <span className="ds-badge ds-badge--line">выдано заданием</span>}
          </div>
        )}
      </div>
      {!editing && (
        <div className="pl-acts">
          {(canUp || canDown) && (
            <>
              <button type="button" className="ds-btn ds-btn--icon tb-del" aria-label="Поднять выше" disabled={busy || !canUp} onClick={() => onMove(-1)}><MMIcon name="caret" size={16} style={{ transform: 'rotate(180deg)' }} /></button>
              <button type="button" className="ds-btn ds-btn--icon tb-del" aria-label="Опустить ниже" disabled={busy || !canDown} onClick={() => onMove(1)}><MMIcon name="caret" size={16} /></button>
            </>
          )}
          {phases && onSetPhase && <PhaseMenu item={item} busy={busy} phases={phases} onPick={onSetPhase} />}
          <button type="button" className="ds-btn ds-btn--icon tb-del" aria-label="Изменить текст пункта" disabled={busy} onClick={() => setEditing(true)}><MMIcon name="edit" size={16} /></button>
          <button type="button" className="ds-btn ds-btn--icon tb-del" aria-label="Удалить пункт" disabled={busy} onClick={onDelete}><MMIcon name="trash" size={16} /></button>
        </div>
      )}
    </div>
  );
}
