import type { NodeType } from '../modeMapData';

// Выбор формы нового режима в палитре (основные типы + подтипы копинга).
// Вынесено из ModeMapPalette.tsx — файл сверх потолка 300 (правило №10),
// а этот блок чисто презентационный: тип/подтип и их сеттеры.
interface Props {
  newType: NodeType;
  newCopingSub: 'over' | 'avoid' | 'surr';
  setNewType: (t: NodeType) => void;
  setNewCopingSub: (s: 'over' | 'avoid' | 'surr') => void;
}

const btnStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  padding: '4px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 9,
  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
  background: active ? 'var(--accent-soft)' : 'none',
  color: active ? 'var(--accent)' : 'var(--text-faint)',
});

export function ShapePicker({ newType, newCopingSub, setNewType, setNewCopingSub }: Props) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
      {([
        { type: 'child' as NodeType,   label: 'Дет.',  shape: 'circle'  },
        { type: 'critic' as NodeType,  label: 'Крит.', shape: 'oct'     },
        { type: 'healthy' as NodeType, label: 'Здор.', shape: 'rect'    },
        { type: 'custom' as NodeType,  label: 'Свой',  shape: 'rect2'   },
      ]).map(opt => (
        <button key={opt.type} onClick={() => setNewType(opt.type)} title={opt.label}
          style={btnStyle(newType === opt.type && newType !== 'coping')}>
          <MiniShapePreview shape={opt.shape} />
          {opt.label}
        </button>
      ))}
      {([
        { sub: 'over' as const,  label: 'Гипер.', shape: 'penta'  },
        { sub: 'avoid' as const, label: 'Избег.', shape: 'shield' },
        { sub: 'surr' as const,  label: 'Капит.', shape: 'pill'   },
      ]).map(opt => (
        <button key={opt.sub} onClick={() => { setNewType('coping'); setNewCopingSub(opt.sub); }}
          title={opt.label} style={btnStyle(newType === 'coping' && newCopingSub === opt.sub)}>
          <MiniShapePreview shape={opt.shape} />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function MiniShapePreview({ shape }: { shape: string }) {
  const c = 'rgba(var(--fg-rgb),0.5)';
  const s: React.CSSProperties = { width: 16, height: 16, border: `1.5px solid ${c}`, flexShrink: 0 };
  if (shape === 'circle')  return <div style={{ ...s, borderRadius: '50%' }} />;
  if (shape === 'pill')    return <div style={{ ...s, borderRadius: 9999 }} />;
  if (shape === 'rect')    return <div style={{ ...s, borderRadius: 3 }} />;
  if (shape === 'rect2')   return <div style={{ ...s, borderRadius: 5 }} />;
  if (shape === 'penta')   return (
    <svg width={16} height={16} viewBox="0 0 10 10">
      <path d="M5,0 L10,3.8 L8.2,10 L1.8,10 L0,3.8 Z" fill="none" stroke={c} strokeWidth="1.2" />
    </svg>
  );
  if (shape === 'shield')  return (
    <svg width={16} height={16} viewBox="0 0 10 10">
      <path d="M0,0 L10,0 L10,7 L5,10 L0,7 Z" fill="none" stroke={c} strokeWidth="1.2" />
    </svg>
  );
  if (shape === 'oct')     return (
    <svg width={16} height={16} viewBox="0 0 10 10">
      <path d="M1.4,0 L8.6,0 L10,1.4 L10,8.6 L8.6,10 L1.4,10 L0,8.6 L0,1.4 Z" fill="none" stroke={c} strokeWidth="1.2" />
    </svg>
  );
  return <div style={{ ...s, borderRadius: 3 }} />;
}
