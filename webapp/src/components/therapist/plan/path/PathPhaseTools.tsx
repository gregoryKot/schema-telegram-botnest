import { MMIcon } from '../../../modeMapIcons';

interface Props {
  name: string;
  busy: boolean;
  canUp: boolean;
  canDown: boolean;
  onEdit: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}

/** Правка фазы: изменить, переставить, удалить — строкой под содержимым раскрытой фазы. */
export function PathPhaseTools({ name, busy, canUp, canDown, onEdit, onMove, onDelete }: Props) {
  return (
    <div className="ph-edit">
      <button type="button" className="ds-btn ds-btn--icon tb-del" aria-label={`Изменить фазу «${name}»`} disabled={busy} onClick={onEdit}><MMIcon name="edit" size={16} /></button>
      <button type="button" className="ds-btn ds-btn--icon tb-del" aria-label="Фазу выше" disabled={busy || !canUp} onClick={() => onMove(-1)}><MMIcon name="caret" size={16} style={{ transform: 'rotate(180deg)' }} /></button>
      <button type="button" className="ds-btn ds-btn--icon tb-del" aria-label="Фазу ниже" disabled={busy || !canDown} onClick={() => onMove(1)}><MMIcon name="caret" size={16} /></button>
      <button type="button" className="ds-btn ds-btn--icon tb-del" aria-label={`Удалить фазу «${name}»`} disabled={busy} onClick={onDelete}><MMIcon name="trash" size={16} /></button>
    </div>
  );
}
