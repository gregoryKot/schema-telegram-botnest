import { MODE_GROUPS } from '../schemaTherapyData';
import type { ModeMapNode } from '../api';

type NodeType = ModeMapNode['type'];

const TYPE_META: Record<string, { type: NodeType; color: string }> = {
  child:   { type: 'child',   color: 'var(--accent-blue)' },
  critic:  { type: 'critic',  color: 'var(--accent-red)' },
  coping:  { type: 'coping',  color: 'var(--accent-orange)' },
  healthy: { type: 'healthy', color: 'var(--accent-green)' },
};

interface Props {
  onAdd: (node: Omit<ModeMapNode, 'position'>) => void;
}

export function ModeMapPalette({ onAdd }: Props) {
  const makeNode = (modeId: string, type: NodeType, label: string): Omit<ModeMapNode, 'position'> => ({
    id: `${modeId}_${Date.now()}`,
    type,
    data: { modeId, label },
  });

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      borderRight: '1px solid rgba(var(--fg-rgb),0.07)',
      overflowY: 'auto',
      background: 'rgba(var(--fg-rgb),0.02)',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      {/* Trigger special node */}
      <div style={{ padding: '12px 14px 6px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)' }}>
        Отправная точка
      </div>
      <button
        onClick={() => onAdd({ id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })}
        style={paletteItemStyle('rgba(var(--fg-rgb),0.35)')}
      >
        <span style={{ fontSize: 15 }}>⚡</span>
        <span>Триггер</span>
      </button>

      {/* Mode groups from schemaTherapyData */}
      {MODE_GROUPS.map(group => {
        const meta = TYPE_META[group.id];
        if (!meta) return null;
        return (
          <div key={group.id}>
            <div style={{ padding: '10px 14px 4px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: group.color }}>
              {group.group}
            </div>
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => onAdd(makeNode(item.id, meta.type, item.name))}
                style={paletteItemStyle(meta.color)}
                title={item.short}
              >
                <span style={{ fontSize: 13 }}>{item.emoji}</span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 12 }}>{item.name}</span>
              </button>
            ))}
          </div>
        );
      })}

      {/* Custom mode */}
      <div style={{ padding: '10px 14px 4px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)' }}>
        Свой режим
      </div>
      <button
        onClick={() => onAdd({ id: `custom_${Date.now()}`, type: 'custom', data: { label: 'Мой режим' } })}
        style={paletteItemStyle('var(--accent)')}
      >
        <span style={{ fontSize: 15 }}>＋</span>
        <span>Добавить свой</span>
      </button>
    </div>
  );
}

function paletteItemStyle(color: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '7px 14px',
    background: 'none',
    border: 'none',
    borderLeft: `3px solid transparent`,
    cursor: 'pointer',
    fontSize: 12.5,
    color: 'var(--text)',
    textAlign: 'left',
    transition: 'background 0.1s',
    outline: 'none',
  };
}
