import type { ModeMapNode, ModeMapEdge, EdgeType } from '../api';
import { TYPE_COLORS } from './ModeMapNodes';

const EDGE_TYPE_LABELS: Record<string, string> = {
  activates:  'активирует',
  protects:   'защищает от',
  suppresses: 'подавляет',
  leads_to:   'ведёт к',
};

const COLOR_PRESETS = [
  '#7aa3d4','#d47a7a','#d4a07a','#7ab87a',
  '#9f7ad4','#b07ab8','#7ab8b0','#94a3b8',
];

type NodeType = ModeMapNode['type'];

// CSS shape previews instead of emoji
const SHAPE_OPTIONS: { type: NodeType; label: string }[] = [
  { type: 'child',   label: 'Детский'  },
  { type: 'critic',  label: 'Критик'   },
  { type: 'coping',  label: 'Копинг'   },
  { type: 'healthy', label: 'Здоровый' },
  { type: 'custom',  label: 'Свой'     },
  { type: 'trigger', label: 'Триггер'  },
];

function ShapePreview({ type, color }: { type: NodeType; color: string }) {
  const base: React.CSSProperties = {
    width: 28, height: 28, background: `${color}22`,
    border: `2px solid ${color}`, flexShrink: 0,
  };
  if (type === 'child')   return <div style={{ ...base, borderRadius: '50%' }} />;
  if (type === 'critic')  return <div style={{ ...base, borderRadius: 3 }} />;
  if (type === 'coping')  return <div style={{ ...base, borderRadius: 0, clipPath: 'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)' }} />;
  if (type === 'healthy') return <div style={{ ...base, borderRadius: 8 }} />;
  if (type === 'trigger') return (
    <svg width={28} height={20} viewBox="0 0 28 20">
      <path d="M5,16 Q1,16 1,11 Q1,7 5,6 Q4,2 8,2 Q11,0 14,2 Q18,0 21,3 Q25,3 27,7 Q27,12 23,13 Q24,16 20,16 Z"
        fill={`${color}22`} stroke={color} strokeWidth={1.5} />
    </svg>
  );
  return <div style={{ ...base, borderRadius: 8 }} />;
}

interface NodeEditorProps {
  node: ModeMapNode;
  onChange: (updated: ModeMapNode) => void;
  onDelete: () => void;
}

export function ModeMapNodeEditor({ node, onChange, onDelete }: NodeEditorProps) {
  const patchData = (d: Partial<ModeMapNode['data']>) =>
    onChange({ ...node, data: { ...node.data, ...d } });
  const patchType = (type: NodeType) => onChange({ ...node, type });
  const currentColor = node.data.customColor ?? TYPE_COLORS[node.type] ?? TYPE_COLORS.custom;

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Режим</div>

      <label style={labelStyle}>Название</label>
      <input style={inputStyle} value={node.data.label}
        onChange={e => patchData({ label: e.target.value })} placeholder="Название режима" />

      <label style={labelStyle}>Форма и тип</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {SHAPE_OPTIONS.map(opt => (
          <button key={opt.type} onClick={() => patchType(opt.type)} title={opt.label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38, borderRadius: 7, cursor: 'pointer',
              border: `1.5px solid ${node.type === opt.type ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.14)'}`,
              background: node.type === opt.type ? 'var(--accent-soft)' : 'none',
            }}>
            <ShapePreview type={opt.type} color={node.type === opt.type ? 'var(--accent)' : currentColor} />
          </button>
        ))}
      </div>

      <label style={labelStyle}>Цвет</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {COLOR_PRESETS.map(c => (
          <button key={c} onClick={() => patchData({ customColor: c })}
            style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
              border: currentColor === c ? '2px solid var(--text)' : '2px solid transparent' }} />
        ))}
        <button onClick={() => patchData({ customColor: undefined })} title="Сбросить"
          style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', cursor: 'pointer', padding: 0,
            border: '2px dashed rgba(var(--fg-rgb),0.25)', fontSize: 10, color: 'var(--text-faint)' }}>✕</button>
      </div>

      <label style={labelStyle}>Заливка</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([
          { label: 'Лёгкая', filled: false, fillFull: false },
          { label: 'Средняя', filled: true,  fillFull: false },
          { label: 'Полная',  filled: false, fillFull: true  },
        ] as const).map(opt => {
          const active = !!node.data.fillFull === opt.fillFull && !!node.data.filled === opt.filled;
          return (
            <button key={opt.label} onClick={() => patchData({ filled: opt.filled, fillFull: opt.fillFull })}
              style={{ flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11.5, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.14)'}`,
                background: active ? 'var(--accent-soft)' : 'none',
                color: active ? 'var(--accent)' : 'var(--text-sub)' }}>
              {opt.label}
            </button>
          );
        })}
      </div>

      <label style={labelStyle}>Заметка</label>
      <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 56 }} rows={3}
        value={node.data.note ?? ''} onChange={e => patchData({ note: e.target.value || undefined })}
        placeholder="Как этот режим проявляется у клиента" />

      {(node.type === 'child' || node.type === 'custom') && (
        <>
          <label style={labelStyle}>Неудовлетворённая потребность</label>
          <input style={inputStyle} value={node.data.unmetNeed ?? ''}
            onChange={e => patchData({ unmetNeed: e.target.value || undefined })}
            placeholder="Безопасность, принятие…" />
        </>
      )}

      <button onClick={onDelete} style={deleteBtnStyle}>Удалить ноду</button>
    </div>
  );
}

interface EdgeEditorProps {
  edge: ModeMapEdge;
  onChange: (updated: ModeMapEdge) => void;
  onDelete: () => void;
}

export function ModeMapEdgeEditor({ edge, onChange, onDelete }: EdgeEditorProps) {
  const edgeType = (edge.data?.edgeType ?? 'activates') as string;
  const bidir = edge.data?.bidirectional ?? false;

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Связь</div>

      <label style={labelStyle}>Тип связи</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {Object.entries(EDGE_TYPE_LABELS).map(([k, v]) => (
          <button key={k}
            onClick={() => onChange({ ...edge, label: bidir ? v : v, data: { ...edge.data, edgeType: k as EdgeType } })}
            style={{ padding: '7px 12px', borderRadius: 6, textAlign: 'left', fontSize: 12.5, cursor: 'pointer',
              border: `1px solid ${edgeType === k ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.12)'}`,
              background: edgeType === k ? 'var(--accent-soft)' : 'none',
              color: edgeType === k ? 'var(--accent)' : 'var(--text-sub)' }}>
            {v}
          </button>
        ))}
      </div>

      <label style={labelStyle}>Направление</label>
      <button onClick={() => onChange({ ...edge, data: { ...edge.data, bidirectional: !bidir } })}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginBottom: 14,
          padding: '7px 10px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer',
          border: `1.5px solid ${bidir ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.14)'}`,
          background: bidir ? 'var(--accent-soft)' : 'none',
          color: bidir ? 'var(--accent)' : 'var(--text-sub)' }}>
        <span style={{ fontSize: 14 }}>{bidir ? '↔' : '→'}</span>
        {bidir ? 'В обе стороны' : 'Одностороннее'}
      </button>

      <label style={labelStyle}>Подпись (необязательно)</label>
      <input style={inputStyle}
        value={typeof edge.label === 'string' && !Object.values(EDGE_TYPE_LABELS).includes(edge.label) ? edge.label : ''}
        onChange={e => onChange({ ...edge, label: e.target.value || EDGE_TYPE_LABELS[edgeType] })}
        placeholder="Своя подпись" />

      <button onClick={onDelete} style={deleteBtnStyle}>Удалить связь</button>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 230, flexShrink: 0,
  borderLeft: '1px solid rgba(var(--fg-rgb),0.07)',
  padding: '16px 14px', overflowY: 'auto',
  background: 'rgba(var(--fg-rgb),0.02)',
  display: 'flex', flexDirection: 'column',
};
const labelStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: 'var(--text-faint)', marginBottom: 5, display: 'block',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid rgba(var(--fg-rgb),0.15)',
  background: 'var(--bg-elev)', color: 'var(--text)',
  fontSize: 13, marginBottom: 14, boxSizing: 'border-box', outline: 'none',
};
const deleteBtnStyle: React.CSSProperties = {
  marginTop: 'auto', padding: '8px 12px', borderRadius: 6,
  border: '1px solid rgba(var(--fg-rgb),0.12)',
  background: 'none', color: 'var(--accent-red)', fontSize: 12.5, cursor: 'pointer',
};
