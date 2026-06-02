import type { ModeMapNode, ModeMapEdge, EdgeType } from '../api';
import { TYPE_COLORS } from './ModeMapNodes';

const EDGE_TYPE_LABELS: Record<string, string> = {
  activates:  'активирует',
  protects:   'защищает от',
  suppresses: 'подавляет',
  leads_to:   'ведёт к',
};

const COLOR_PRESETS = [
  '#7aa3d4', // синий (child)
  '#d47a7a', // красный (critic)
  '#d4a07a', // оранжевый (coping)
  '#7ab87a', // зелёный (healthy)
  '#7a7ad4', // фиолетовый (custom)
  '#b07ab8', // розовый
  '#b8a07a', // тёплый беж
  '#7ab8b0', // бирюза
];

type NodeType = ModeMapNode['type'];

const SHAPE_OPTIONS: { type: NodeType; label: string; icon: string }[] = [
  { type: 'child',   label: 'Детский',   icon: '⭕' },
  { type: 'critic',  label: 'Критик',    icon: '🟥' },
  { type: 'coping',  label: 'Копинг',    icon: '🟧' },
  { type: 'healthy', label: 'Здоровый',  icon: '🟩' },
  { type: 'custom',  label: 'Свой',      icon: '🟦' },
  { type: 'trigger', label: 'Триггер',   icon: '⚡' },
];

interface NodeEditorProps {
  node: ModeMapNode;
  onChange: (updated: ModeMapNode) => void;
  onDelete: () => void;
}

export function ModeMapNodeEditor({ node, onChange, onDelete }: NodeEditorProps) {
  const patchData = (data: Partial<ModeMapNode['data']>) =>
    onChange({ ...node, data: { ...node.data, ...data } });
  const patchType = (type: NodeType) =>
    onChange({ ...node, type });

  const currentColor = node.data.customColor ?? TYPE_COLORS[node.type] ?? TYPE_COLORS.custom;

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Редактировать</div>

      <label style={labelStyle}>Название</label>
      <input
        style={inputStyle}
        value={node.data.label}
        onChange={e => patchData({ label: e.target.value })}
        placeholder="Название режима"
      />

      <label style={labelStyle}>Форма и тип</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {SHAPE_OPTIONS.map(opt => (
          <button
            key={opt.type}
            onClick={() => patchType(opt.type)}
            title={opt.label}
            style={{
              padding: '5px 8px',
              borderRadius: 6,
              border: `1.5px solid ${node.type === opt.type ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.14)'}`,
              background: node.type === opt.type ? 'var(--accent-soft)' : 'none',
              cursor: 'pointer',
              fontSize: 15,
              lineHeight: 1,
            }}
          >
            {opt.icon}
          </button>
        ))}
      </div>

      <label style={labelStyle}>Цвет</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {COLOR_PRESETS.map(c => (
          <button
            key={c}
            onClick={() => patchData({ customColor: c })}
            style={{
              width: 22, height: 22,
              borderRadius: '50%',
              background: c,
              border: currentColor === c ? '2px solid var(--text)' : '2px solid transparent',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
        {/* Reset to default */}
        <button
          onClick={() => patchData({ customColor: undefined })}
          title="Сбросить цвет"
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: 'none',
            border: '2px dashed rgba(var(--fg-rgb),0.25)',
            cursor: 'pointer', fontSize: 11, padding: 0, color: 'var(--text-faint)',
          }}
        >✕</button>
      </div>

      <label style={{ ...labelStyle, marginBottom: 8 }}>Заливка</label>
      <button
        onClick={() => patchData({ filled: !node.data.filled })}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 6, marginBottom: 14,
          border: `1.5px solid ${node.data.filled ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.14)'}`,
          background: node.data.filled ? 'var(--accent-soft)' : 'none',
          cursor: 'pointer', fontSize: 12.5, color: node.data.filled ? 'var(--accent)' : 'var(--text-sub)',
          width: '100%',
        }}
      >
        <span style={{ fontSize: 14 }}>🎨</span>
        {node.data.filled ? 'Насыщенная заливка' : 'Лёгкая заливка'}
      </button>

      <label style={labelStyle}>Заметка терапевта</label>
      <textarea
        style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }}
        value={node.data.note ?? ''}
        onChange={e => patchData({ note: e.target.value || undefined })}
        placeholder="Как этот режим проявляется у клиента"
        rows={3}
      />

      {(node.type === 'child' || node.type === 'custom') && (
        <>
          <label style={labelStyle}>Неудовлетворённая потребность</label>
          <input
            style={inputStyle}
            value={node.data.unmetNeed ?? ''}
            onChange={e => patchData({ unmetNeed: e.target.value || undefined })}
            placeholder="Безопасность, принятие, автономия…"
          />
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

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Редактировать связь</div>

      <label style={labelStyle}>Тип связи</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {Object.entries(EDGE_TYPE_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => onChange({ ...edge, label: v, data: { edgeType: k as EdgeType } })}
            style={{
              padding: '7px 12px', borderRadius: 6, textAlign: 'left',
              border: `1px solid ${edgeType === k ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.12)'}`,
              background: edgeType === k ? 'var(--accent-soft)' : 'none',
              color: edgeType === k ? 'var(--accent)' : 'var(--text-sub)',
              fontSize: 12.5, cursor: 'pointer',
            }}
          >
            {v}
          </button>
        ))}
      </div>

      <label style={labelStyle}>Подпись (необязательно)</label>
      <input
        style={inputStyle}
        value={typeof edge.label === 'string' && !Object.values(EDGE_TYPE_LABELS).includes(edge.label) ? edge.label : ''}
        onChange={e => onChange({ ...edge, label: e.target.value || EDGE_TYPE_LABELS[edgeType] })}
        placeholder="Своя подпись"
      />

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
  letterSpacing: '0.05em', color: 'var(--text-faint)',
  marginBottom: 5, display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid rgba(var(--fg-rgb),0.15)',
  background: 'var(--bg-elev)', color: 'var(--text)',
  fontSize: 13, marginBottom: 14,
  boxSizing: 'border-box', outline: 'none',
};

const deleteBtnStyle: React.CSSProperties = {
  marginTop: 'auto', padding: '8px 12px', borderRadius: 6,
  border: '1px solid rgba(var(--fg-rgb),0.12)',
  background: 'none', color: 'var(--accent-red)',
  fontSize: 12.5, cursor: 'pointer',
};
