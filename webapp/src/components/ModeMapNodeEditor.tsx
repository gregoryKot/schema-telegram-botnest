import type { ModeMapNode, ModeMapEdge, EdgeType } from '../api';

const EDGE_TYPE_LABELS: Record<string, string> = {
  activates:  'активирует',
  protects:   'защищает от',
  suppresses: 'подавляет',
  leads_to:   'ведёт к',
};

interface NodeEditorProps {
  node: ModeMapNode;
  onChange: (updated: ModeMapNode) => void;
  onDelete: () => void;
}

export function ModeMapNodeEditor({ node, onChange, onDelete }: NodeEditorProps) {
  const patch = (data: Partial<ModeMapNode['data']>) =>
    onChange({ ...node, data: { ...node.data, ...data } });

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--text)' }}>
        Редактировать режим
      </div>

      <label style={labelStyle}>Название</label>
      <input
        style={inputStyle}
        value={node.data.label}
        onChange={e => patch({ label: e.target.value })}
        placeholder="Название режима"
      />

      <label style={labelStyle}>Заметка терапевта</label>
      <textarea
        style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
        value={node.data.note ?? ''}
        onChange={e => patch({ note: e.target.value || undefined })}
        placeholder="Как этот режим проявляется у клиента"
        rows={3}
      />

      {node.type === 'child' && (
        <>
          <label style={labelStyle}>Неудовлетворённая потребность</label>
          <input
            style={inputStyle}
            value={node.data.unmetNeed ?? ''}
            onChange={e => patch({ unmetNeed: e.target.value || undefined })}
            placeholder="Безопасность, принятие, автономия…"
          />
        </>
      )}

      <button onClick={onDelete} style={deleteBtnStyle}>
        Удалить ноду
      </button>
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
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--text)' }}>
        Редактировать связь
      </div>

      <label style={labelStyle}>Тип связи</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {Object.entries(EDGE_TYPE_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => onChange({ ...edge, label: v, data: { edgeType: k as EdgeType } })}
            style={{
              padding: '7px 12px',
              borderRadius: 6,
              border: `1px solid ${edgeType === k ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.12)'}`,
              background: edgeType === k ? 'var(--accent-soft)' : 'none',
              color: edgeType === k ? 'var(--accent)' : 'var(--text-sub)',
              fontSize: 12.5,
              cursor: 'pointer',
              textAlign: 'left',
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
        placeholder="Своя подпись на стрелке"
      />

      <button onClick={onDelete} style={deleteBtnStyle}>
        Удалить связь
      </button>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 230,
  flexShrink: 0,
  borderLeft: '1px solid rgba(var(--fg-rgb),0.07)',
  padding: '16px 14px',
  overflowY: 'auto',
  background: 'rgba(var(--fg-rgb),0.02)',
  display: 'flex',
  flexDirection: 'column',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-faint)',
  marginBottom: 5,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid rgba(var(--fg-rgb),0.15)',
  background: 'var(--bg-elev)',
  color: 'var(--text)',
  fontSize: 13,
  marginBottom: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

const deleteBtnStyle: React.CSSProperties = {
  marginTop: 'auto',
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid rgba(var(--fg-rgb),0.12)',
  background: 'none',
  color: 'var(--accent-red)',
  fontSize: 12.5,
  cursor: 'pointer',
};
