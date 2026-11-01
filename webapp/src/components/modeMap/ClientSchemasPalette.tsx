import type { ModeMapNode } from '../../api';
import { getSchemaById } from '../../schemaTherapyData';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { useModeMapConcept } from './clientConceptContext';

type Draft = Omit<ModeMapNode, 'position'>;

interface Props {
  onAdd: (node: Draft) => void;
  onDragStart: (e: React.DragEvent, node: Draft) => void;
}

// Формат узла схемы — как у conceptToModeMap: тип schema, название и schemaId.
const schemaDraft = (schemaId: string): Draft | null => {
  const s = getSchemaById(schemaId);
  if (!s) return null;
  return {
    id: `schema_${schemaId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    type: 'schema', data: { label: s.name, schemaId, customColor: s.domainColor },
  };
};

/** Секция палитры «Схемы клиента»: отмеченные в концептуализации схемы одним кликом ложатся на холст. */
export function ClientSchemasPalette({ onAdd, onDragStart }: Props) {
  const concept = useModeMapConcept();
  if (concept === null) return null; // грузится или клиента нет — секции нет, пустой список не обещаем
  const drafts = concept === 'failed' ? [] : concept.schemaIds.map(schemaDraft).filter((d): d is Draft => d !== null);
  return (
    <div className="mm2-mine">
      <div className="mm2-mine-head"><span className="mm2-pal-head-name">Схемы клиента</span></div>
      {concept === 'failed' && <div className="mm2-pal-sub is-err">Не удалось загрузить схемы клиента</div>}
      {concept !== 'failed' && drafts.length === 0 && <div className="mm2-pal-sub">У клиента пока нет отмеченных схем</div>}
      {drafts.map(d => (
        <button key={d.data.schemaId} onClick={() => onAdd(d)} draggable onDragStart={e => onDragStart(e, d)}
          className="mm2-pal-item" title="Схема из концептуализации клиента" aria-label={`Схема клиента: ${d.data.label}`}>
          <IdentityDot color={d.data.customColor} size={12} />
          <span className="mm2-pal-item-name">{d.data.label}</span>
        </button>
      ))}
    </div>
  );
}
