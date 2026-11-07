import { useState } from 'react';
import { getModeById } from '../../schemaTherapyData';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { MMIcon } from '../modeMapIcons';
import { useModeMapConcept } from './clientConceptContext';
import { findModeMeta } from './modeNodeMeta';
import { makeModeNode, type Draft } from './modeDraft';

interface Props {
  onAdd: (node: Draft) => void;
  onAddMany?: (nodes: Draft[]) => void;
  onDragStart: (e: React.DragEvent, node: Draft) => void;
}

// Заготовка узла режима клиента (из библиотеки или группы).
const clientModeNode = (modeId: string): Draft | null => {
  const meta = findModeMeta(modeId);
  const lib = getModeById(modeId);
  if (!meta && !lib) return null;
  const extra = meta?.copingSubtype ? { copingSubtype: meta.copingSubtype } : {};
  return makeModeNode(modeId, meta?.type ?? 'custom', meta?.name ?? lib?.name ?? modeId, extra);
};
const clientModeColor = (modeId: string): string | undefined =>
  findModeMeta(modeId)?.color ?? getModeById(modeId)?.groupColor;

/** Секция палитры «Режимы клиента» (из концептуализации), сворачиваемая.
    Сбой загрузки показывается, а не молчит: раньше секция просто не рендерилась,
    и терапевт думал, что у клиента режимы не отмечены (три молчания карты режимов). */
export function ClientModesPalette({ onAdd, onAddMany, onDragStart }: Props) {
  const concept = useModeMapConcept();
  const [open, setOpen] = useState(false);
  const ids: string[] | 'failed' = concept === 'failed' ? 'failed' : concept?.modeIds ?? [];
  const list = Array.isArray(ids) ? ids : [];
  if (ids !== 'failed' && list.length === 0) return null;
  return (
    <div className={`mm2-client${open ? ' is-open' : ''}`}>
      <div className="mm2-client-row">
        <button onClick={() => setOpen(o => !o)} className="mm2-pal-head" aria-expanded={open}>
          <span className="mm2-pal-head-name">Режимы клиента</span>
          <span className="mm2-pal-head-n">{ids === 'failed' ? '' : open ? '▲' : `▼ ${list.length}`}</span>
        </button>
        {onAddMany && ids !== 'failed' && (
          <button onClick={() => { const all = list.map(clientModeNode).filter((n): n is Draft => n !== null); if (all.length) onAddMany(all); }}
            title="Вынести все режимы клиента на карту" aria-label="Вынести все режимы клиента на карту"
            className="ds-btn ds-btn--accent mm2-pal-add">
            <MMIcon name="plus" size={11} /> все
          </button>
        )}
      </div>
      {ids === 'failed' ? (
        <div className="mm2-pal-sub is-err">Не удалось загрузить режимы клиента</div>
      ) : open && list.map(modeId => {
        const node = clientModeNode(modeId);
        if (!node) return null;
        const color = clientModeColor(modeId);
        return (
          <button key={modeId} onClick={() => onAdd(node)} draggable onDragStart={e => onDragStart(e, node)}
            className="mm2-pal-item" title="Из концептуализации клиента" aria-label="Из концептуализации клиента">
            {color ? <IdentityDot color={color} size={12} /> : <span>◆</span>}
            <span className="mm2-pal-item-name">{node.data.label}</span>
          </button>
        );
      })}
    </div>
  );
}
