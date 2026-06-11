import { TYPE_COLORS } from './ModeMapNodes';
import { MMIcon } from './modeMapIcons';

const ITEMS: { label: string; shape: 'cloud' | 'circle' | 'oct' | 'penta' | 'shield' | 'pill' | 'rect'; color: string }[] = [
  { label: 'Триггер / ситуация', shape: 'cloud',  color: TYPE_COLORS.trigger },
  { label: 'Детский режим',      shape: 'circle', color: TYPE_COLORS.child },
  { label: 'Критик',             shape: 'oct',    color: TYPE_COLORS.critic },
  { label: 'Копинг: гипер',      shape: 'penta',  color: TYPE_COLORS.coping },
  { label: 'Копинг: избегание',  shape: 'shield', color: TYPE_COLORS.coping },
  { label: 'Копинг: капитуляция',shape: 'pill',   color: TYPE_COLORS.coping },
  { label: 'Здоровый / свой',    shape: 'rect',   color: TYPE_COLORS.healthy },
];

function Glyph({ shape, color }: { shape: string; color: string }) {
  const c = color, sw = 1.6, fill = color.startsWith('#') ? `${color}22` : `color-mix(in srgb, ${color} 16%, transparent)`;
  const paths: Record<string, string> = {
    oct:    'M4,1 L20,1 L23,4 L23,20 L20,23 L4,23 L1,20 L1,4 Z',
    penta:  'M12,1 L23,9 L19,23 L5,23 L1,9 Z',
    shield: 'M2,2 L22,2 L22,16 L12,23 L2,16 Z',
    cloud:  'M6,18 Q2,18 2,14 Q2,9 7,9 Q6,3 12,3 Q16,1 19,4 Q23,4 23,9 Q23,18 18,18 Z',
  };
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      {shape === 'circle' ? <circle cx={12} cy={12} r={10.5} fill={fill} stroke={c} strokeWidth={sw} />
        : shape === 'pill' ? <rect x={1} y={7} width={22} height={10} rx={5} fill={fill} stroke={c} strokeWidth={sw} />
        : shape === 'rect' ? <rect x={2} y={5} width={20} height={14} rx={3} fill={fill} stroke={c} strokeWidth={sw} />
        : <path d={paths[shape]} fill={fill} stroke={c} strokeWidth={sw} />}
    </svg>
  );
}

export function ModeMapLegend({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      background: 'var(--bg-elev)', border: '1px solid var(--line)',
      borderRadius: 12, padding: '11px 13px', boxShadow: 'var(--shadow-2)',
      fontSize: 12, minWidth: 188,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)' }}>Легенда</span>
        <button onClick={onClose} title="Скрыть" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: 0, display: 'flex' }}><MMIcon name="close" size={14} /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ITEMS.map(it => (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Glyph shape={it.shape} color={it.color} />
            <span style={{ color: 'var(--text-sub)' }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
