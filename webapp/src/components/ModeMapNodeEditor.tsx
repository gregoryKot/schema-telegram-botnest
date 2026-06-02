import type { ModeMapNode, ModeMapEdge, EdgeType } from '../api';
import { TYPE_COLORS } from './ModeMapNodes';

type CopingSubtype = 'over' | 'avoid' | 'surr';

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

interface ShapeOption {
  type: NodeType;
  label: string;
  copingSubtype?: CopingSubtype;
  color: string;
  clip?: string;
  radius?: number | string;
  isCircle?: boolean;
  isCloud?: boolean;
}

const SHAPE_OPTIONS: ShapeOption[] = [
  { type: 'trigger', label: 'Триггер',        color: TYPE_COLORS.trigger, isCloud: true },
  { type: 'child',   label: 'Детский',         color: TYPE_COLORS.child,   isCircle: true },
  { type: 'critic',  label: 'Критик',          color: TYPE_COLORS.critic,
    clip: 'polygon(14% 0%,86% 0%,100% 14%,100% 86%,86% 100%,14% 100%,0% 86%,0% 14%)' },
  { type: 'coping',  label: 'Гиперкомп.',      color: '#d4a07a', copingSubtype: 'over',
    clip: 'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)' },
  { type: 'coping',  label: 'Избегание',       color: '#7aa3d4', copingSubtype: 'avoid',
    clip: 'polygon(0% 0%,100% 0%,100% 72%,50% 100%,0% 72%)' },
  { type: 'coping',  label: 'Капитуляция',     color: '#94a3b8', copingSubtype: 'surr', radius: 9999 },
  { type: 'healthy', label: 'Здоровый',        color: TYPE_COLORS.healthy, radius: 8 },
  { type: 'custom',  label: 'Свой',            color: TYPE_COLORS.custom,  radius: 8 },
];

function ShapePreview({ opt, active }: { opt: ShapeOption; active: boolean }) {
  const color = active ? 'var(--accent)' : opt.color;
  const bg = `${opt.color}25`;
  const w = 26; const h = opt.isCloud ? 18 : opt.isCircle ? 26 : 26;

  if (opt.isCloud) return (
    <svg width={w} height={h} viewBox="0 0 28 18">
      <path d="M5,14 Q1,14 1,10 Q1,6 5,6 Q4,1 9,1 Q12,0 15,2 Q19,0 22,3 Q27,3 27,8 Q27,14 22,14 Z"
        fill={bg} stroke={color} strokeWidth={1.5} />
    </svg>
  );

  const style: React.CSSProperties = {
    width: w, height: h, background: bg, border: `2px solid ${color}`, flexShrink: 0,
    borderRadius: typeof opt.radius === 'number' ? opt.radius : opt.isCircle ? '50%' : undefined,
    clipPath: opt.clip,
  };
  return <div style={style} />;
}

interface NodeEditorProps {
  node: ModeMapNode;
  onChange: (updated: ModeMapNode) => void;
  onDelete: () => void;
}

export function ModeMapNodeEditor({ node, onChange, onDelete }: NodeEditorProps) {
  const patchData = (d: Partial<ModeMapNode['data']>) =>
    onChange({ ...node, data: { ...node.data, ...d } });
  const patchShape = (opt: ShapeOption) => onChange({
    ...node,
    type: opt.type,
    data: { ...node.data, copingSubtype: opt.copingSubtype },
  });
  const currentColor = node.data.customColor ?? TYPE_COLORS[node.type] ?? TYPE_COLORS.custom;

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Режим</div>

      <label style={labelStyle}>Название</label>
      <input style={inputStyle} value={node.data.label}
        onChange={e => patchData({ label: e.target.value })} placeholder="Название режима" />

      <label style={labelStyle}>Форма и тип</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
        {SHAPE_OPTIONS.map((opt, i) => {
          const isActive = node.type === opt.type &&
            (opt.copingSubtype ? node.data.copingSubtype === opt.copingSubtype : !opt.copingSubtype || node.type !== 'coping');
          return (
            <button key={i} onClick={() => patchShape(opt)} title={opt.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, width: 44, height: 44, borderRadius: 7, cursor: 'pointer',
                border: `1.5px solid ${isActive ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.14)'}`,
                background: isActive ? 'var(--accent-soft)' : 'none',
                padding: 4,
              }}>
              <ShapePreview opt={opt} active={isActive} />
              <span style={{ fontSize: 9, color: isActive ? 'var(--accent)' : 'var(--text-faint)', lineHeight: 1, textAlign: 'center' }}>
                {opt.label}
              </span>
            </button>
          );
        })}
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
  onSwap: () => void;
}

export function ModeMapEdgeEditor({ edge, onChange, onDelete, onSwap }: EdgeEditorProps) {
  const edgeType = (edge.data?.edgeType ?? 'activates') as string;
  const bidir = edge.data?.bidirectional ?? false;

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Связь</div>

      <label style={labelStyle}>Тип связи</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {Object.entries(EDGE_TYPE_LABELS).map(([k, v]) => (
          <button key={k}
            onClick={() => onChange({ ...edge, data: { ...edge.data, edgeType: k as EdgeType } })}
            style={{ padding: '7px 12px', borderRadius: 6, textAlign: 'left', fontSize: 12.5, cursor: 'pointer',
              border: `1px solid ${edgeType === k ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.12)'}`,
              background: edgeType === k ? 'var(--accent-soft)' : 'none',
              color: edgeType === k ? 'var(--accent)' : 'var(--text-sub)' }}>
            {v}
          </button>
        ))}
      </div>

      <label style={labelStyle}>Направление</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button onClick={() => onChange({ ...edge, data: { ...edge.data, bidirectional: !bidir } })}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 10px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer',
            border: `1.5px solid ${bidir ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.14)'}`,
            background: bidir ? 'var(--accent-soft)' : 'none',
            color: bidir ? 'var(--accent)' : 'var(--text-sub)' }}>
          <span style={{ fontSize: 14 }}>{bidir ? '↔' : '→'}</span>
          {bidir ? 'Двусторонняя' : 'Односторонняя'}
        </button>
        <button onClick={onSwap} title="Поменять направление (откуда → куда)"
          style={{ padding: '7px 10px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
            border: '1px solid rgba(var(--fg-rgb),0.14)', background: 'none',
            color: 'var(--text-sub)' }}>
          ⇄
        </button>
      </div>

      <label style={labelStyle}>Подпись (необязательно)</label>
      <input style={inputStyle}
        value={edge.label ?? ''}
        onChange={e => onChange({ ...edge, label: e.target.value || undefined })}
        placeholder="Текст на стрелке" />

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
