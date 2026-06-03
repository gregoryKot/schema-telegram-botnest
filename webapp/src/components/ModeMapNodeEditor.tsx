import type { ModeMapNode, ModeMapEdge, EdgeType } from '../api';
import { TYPE_COLORS } from './ModeMapNodes';

type CopingSubtype = 'over' | 'avoid' | 'surr';

// Type-specific clinical questions — keep the focus on the chain
// (триггер → боль → защита → последствия → потребность), not on naming.
function clinicalQuestions(node: ModeMapNode): string[] {
  const sub = node.data.copingSubtype;
  switch (node.type) {
    case 'trigger':
      return ['Что конкретно произошло?', 'Что клиент увидел, услышал, вспомнил?'];
    case 'child':
      return ['Что чувствует эта часть?', 'Какая детская потребность не удовлетворена?', 'Сколько ему лет в этот момент?'];
    case 'critic':
      return ['Чей это голос?', 'Что говорит дословно?', 'Чем грозит, если не послушаться?'];
    case 'coping':
      if (sub === 'avoid')  return ['От чего уводит?', 'Что отключает или избегает?', 'Какую боль ребёнка прячет?'];
      if (sub === 'surr')   return ['Кому подчиняется?', 'Чего боится, если перестанет?', 'Какую боль ребёнка прячет?'];
      return ['От какой боли защищает?', 'Что делает в поведении?', 'Какую цену клиент платит?'];
    case 'healthy':
      return ['Кого защищает?', 'Кому ставит границы?', 'Какие потребности удовлетворяет?'];
    default:
      return ['Как этот режим проявляется?', 'Что он делает в поведении?'];
  }
}

function ClinicalHint({ node }: { node: ModeMapNode }) {
  const qs = clinicalQuestions(node);
  return (
    <div style={{
      background: 'var(--accent-soft)', borderRadius: 7, padding: '8px 10px', marginBottom: 14,
      border: '1px solid var(--accent-line)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
        💡 Спросить себя
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {qs.map((q, i) => (
          <li key={i} style={{ fontSize: 11.5, color: 'var(--text-sub)', lineHeight: 1.35 }}>{q}</li>
        ))}
      </ul>
    </div>
  );
}

const EDGE_TYPE_LABELS: Record<string, string> = {
  activates:  'активирует',
  protects:   'защищает от',
  suppresses: 'подавляет',
  leads_to:   'ведёт к',
};

const EDGE_TYPE_COLORS: Record<string, string> = {
  activates:  'rgba(var(--fg-rgb),0.45)',
  protects:   'var(--accent-green)',
  suppresses: 'var(--accent-red)',
  leads_to:   'var(--accent-orange)',
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
  { type: 'trigger', label: 'Триггер', color: TYPE_COLORS.trigger, isCloud: true },
  { type: 'child',   label: 'Детский', color: TYPE_COLORS.child,   isCircle: true },
  { type: 'critic',  label: 'Критик',  color: TYPE_COLORS.critic },
  { type: 'coping',  label: 'Гипер',   color: '#d4a07a', copingSubtype: 'over' },
  { type: 'coping',  label: 'Избег',   color: '#7aa3d4', copingSubtype: 'avoid' },
  { type: 'coping',  label: 'Капит',   color: '#94a3b8', copingSubtype: 'surr' },
  { type: 'healthy', label: 'Здоров',  color: TYPE_COLORS.healthy },
  { type: 'custom',  label: 'Свой',    color: TYPE_COLORS.custom },
];

// All previews drawn in a fixed 24x24 box so picker borders align perfectly
function ShapePreview({ opt, active }: { opt: ShapeOption; active: boolean }) {
  const stroke = active ? 'var(--accent)' : opt.color;
  const fill = `${opt.color}22`;
  const sw = 1.6;
  const paths: Record<string, string> = {
    critic: 'M4,1 L20,1 L23,4 L23,20 L20,23 L4,23 L1,20 L1,4 Z',     // octagon
    over:   'M12,1 L23,9 L19,23 L5,23 L1,9 Z',                        // pentagon
    avoid:  'M2,2 L22,2 L22,16 L12,23 L2,16 Z',                       // shield
  };
  const key = opt.copingSubtype === 'over' ? 'over'
    : opt.copingSubtype === 'avoid' ? 'avoid'
    : opt.type === 'critic' ? 'critic' : null;

  return (
    <svg width={22} height={22} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      {opt.isCloud ? (
        <path d="M6,18 Q2,18 2,14 Q2,9 7,9 Q6,3 12,3 Q16,1 19,4 Q23,4 23,9 Q23,18 18,18 Z"
          fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : opt.isCircle ? (
        <circle cx={12} cy={12} r={10.5} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : opt.copingSubtype === 'surr' ? (
        <rect x={1} y={6} width={22} height={12} rx={6} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : key ? (
        <path d={paths[key]} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : (
        <rect x={2} y={4} width={20} height={16} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} />
      )}
    </svg>
  );
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginBottom: 14 }}>
        {SHAPE_OPTIONS.map((opt, i) => {
          const isActive = node.type === opt.type &&
            (node.type === 'coping' ? node.data.copingSubtype === opt.copingSubtype : true);
          return (
            <button key={i} onClick={() => patchShape(opt)} title={opt.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, height: 46, borderRadius: 7, cursor: 'pointer', boxSizing: 'border-box',
                border: `1.5px solid ${isActive ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.14)'}`,
                background: isActive ? 'var(--accent-soft)' : 'none', padding: 2,
              }}>
              <ShapePreview opt={opt} active={isActive} />
              <span style={{ fontSize: 8.5, color: isActive ? 'var(--accent)' : 'var(--text-faint)', lineHeight: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>
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

      {/* Clinical questions — guide what to capture for this mode type */}
      <ClinicalHint node={node} />

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

      <label style={labelStyle}>Тип связи (задаёт цвет)</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {Object.entries(EDGE_TYPE_LABELS).map(([k, v]) => (
          <button key={k}
            onClick={() => onChange({ ...edge, data: { ...edge.data, edgeType: k as EdgeType } })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 6, textAlign: 'left', fontSize: 12.5, cursor: 'pointer',
              border: `1px solid ${edgeType === k ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.12)'}`,
              background: edgeType === k ? 'var(--accent-soft)' : 'none',
              color: edgeType === k ? 'var(--accent)' : 'var(--text-sub)' }}>
            <span style={{ width: 16, height: 3, borderRadius: 2, background: EDGE_TYPE_COLORS[k], flexShrink: 0 }} />
            {v}
          </button>
        ))}
      </div>

      <label style={labelStyle}>Стиль линии</label>
      <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
        {([
          { k: 'solid'  as const, label: 'Сплошная', dash: 'none' },
          { k: 'dashed' as const, label: 'Пунктир',  dash: '6 4' },
          { k: 'dotted' as const, label: 'Точки',    dash: '1.5 4' },
        ]).map(opt => {
          const active = (edge.data?.lineStyle ?? 'solid') === opt.k;
          return (
            <button key={opt.k} onClick={() => onChange({ ...edge, data: { ...edge.data, lineStyle: opt.k } })}
              title={opt.label}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '7px 4px', borderRadius: 6, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.14)'}`,
                background: active ? 'var(--accent-soft)' : 'none' }}>
              <svg width={36} height={6} viewBox="0 0 36 6">
                <line x1={1} y1={3} x2={35} y2={3} stroke={active ? 'var(--accent)' : 'var(--text-sub)'}
                  strokeWidth={2} strokeDasharray={opt.dash === 'none' ? undefined : opt.dash} strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 9, color: active ? 'var(--accent)' : 'var(--text-faint)' }}>{opt.label}</span>
            </button>
          );
        })}
      </div>

      <label style={labelStyle}>Направление</label>
      <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
        {/* One-way (current direction) */}
        <button onClick={() => onChange({ ...edge, data: { ...edge.data, bidirectional: false } })}
          title="Одна стрелка"
          style={dirBtnStyle(!bidir)}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
          <span style={{ fontSize: 9 }}>одна</span>
        </button>
        {/* Both ways */}
        <button onClick={() => onChange({ ...edge, data: { ...edge.data, bidirectional: true } })}
          title="Две стрелки"
          style={dirBtnStyle(bidir)}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>↔</span>
          <span style={{ fontSize: 9 }}>обе</span>
        </button>
        {/* Reverse — swaps source/target */}
        <button onClick={onSwap} title="Развернуть (поменять начало и конец)"
          style={dirBtnStyle(false)}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>⤺</span>
          <span style={{ fontSize: 9 }}>развернуть</span>
        </button>
      </div>

      <label style={labelStyle}>Цвет стрелки</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {['#d47a7a','#7ab87a','#d4a07a','#7aa3d4','#9f7ad4','#94a3b8'].map(c => (
          <button key={c} onClick={() => onChange({ ...edge, data: { ...edge.data, color: c } })}
            style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
              border: edge.data?.color === c ? '2px solid var(--text)' : '2px solid transparent' }} />
        ))}
        <button onClick={() => onChange({ ...edge, data: { ...edge.data, color: undefined } })} title="По типу связи"
          style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', cursor: 'pointer', padding: 0,
            border: '2px dashed rgba(var(--fg-rgb),0.25)', fontSize: 10, color: 'var(--text-faint)' }}>✕</button>
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

function dirBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 2, padding: '6px 4px', borderRadius: 6, cursor: 'pointer',
    border: `1.5px solid ${active ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.14)'}`,
    background: active ? 'var(--accent-soft)' : 'none',
    color: active ? 'var(--accent)' : 'var(--text-sub)',
  };
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
