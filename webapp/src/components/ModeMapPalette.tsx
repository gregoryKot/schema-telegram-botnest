import { useState } from 'react';
import { MODE_GROUPS } from '../schemaTherapyData';
import type { ModeMapNode } from '../api';

type NodeType = ModeMapNode['type'];

// Maps every group id from schemaTherapyData → node type + border color for the canvas node
const GROUP_TO_TYPE: Record<string, { type: NodeType; color: string }> = {
  child:                   { type: 'child',   color: 'var(--accent-blue)' },
  coping_surrender:        { type: 'coping',  color: '#94a3b8' },
  coping_avoidance:        { type: 'coping',  color: 'var(--accent)' },
  coping_overcompensation: { type: 'coping',  color: 'var(--accent-orange)' },
  critic:                  { type: 'critic',  color: 'var(--accent-red)' },
  healthy:                 { type: 'healthy', color: 'var(--accent-green)' },
};

export const DRAG_TYPE = 'application/modemap-node';

interface Props {
  onAdd: (node: Omit<ModeMapNode, 'position'>) => void;
}

export function ModeMapPalette({ onAdd }: Props) {
  const [search, setSearch] = useState('');

  const makeNode = (modeId: string, type: NodeType, label: string): Omit<ModeMapNode, 'position'> => ({
    id: `${modeId}_${Date.now()}`,
    type,
    data: { modeId, label },
  });

  const onDragStart = (e: React.DragEvent, partial: Omit<ModeMapNode, 'position'>) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(partial));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const q = search.trim().toLowerCase();

  return (
    <div style={{
      width: 224,
      flexShrink: 0,
      borderRight: '1px solid rgba(var(--fg-rgb),0.07)',
      overflowY: 'auto',
      background: 'rgba(var(--fg-rgb),0.02)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Search */}
      <div style={{ padding: '10px 10px 6px', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1, borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск режима…"
          style={{
            width: '100%',
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid rgba(var(--fg-rgb),0.14)',
            background: 'var(--bg-elev)',
            color: 'var(--text)',
            fontSize: 12.5,
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {/* Trigger — hide during search */}
      {!q && (
        <>
          <div style={groupLabelStyle('rgba(var(--fg-rgb),0.35)')}>Отправная точка</div>
          <button
            onClick={() => onAdd({ id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })}
            draggable
            onDragStart={e => onDragStart(e, { id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })}
            style={itemStyle}
            title="Внешняя ситуация или воспоминание, запускающее цикл"
          >
            <span style={{ fontSize: 14 }}>⚡</span>
            <span>Триггер</span>
          </button>
        </>
      )}

      {/* All mode groups */}
      {MODE_GROUPS.map(group => {
        const meta = GROUP_TO_TYPE[group.id];
        if (!meta) return null;

        const items = q
          ? group.items.filter(i => i.name.toLowerCase().includes(q) || i.short.toLowerCase().includes(q))
          : group.items;

        if (items.length === 0) return null;

        return (
          <div key={group.id}>
            {!q && (
              <div style={groupLabelStyle(group.color)}>{group.group}</div>
            )}
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => onAdd(makeNode(item.id, meta.type, item.name))}
                draggable
                onDragStart={e => onDragStart(e, makeNode(item.id, meta.type, item.name))}
                style={itemStyle}
                title={item.short}
              >
                <span style={{ fontSize: 13 }}>{item.emoji}</span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 12, lineHeight: 1.3 }}>{item.name}</span>
                {q && (
                  <span style={{ fontSize: 10, color: group.color, flexShrink: 0 }}>
                    {group.group.replace('Копинг: ', '')}
                  </span>
                )}
              </button>
            ))}
          </div>
        );
      })}

      {/* Custom mode */}
      {!q && (
        <>
          <div style={groupLabelStyle('var(--accent)')}>Свой режим</div>
          <button
            onClick={() => onAdd({ id: `custom_${Date.now()}`, type: 'custom', data: { label: 'Мой режим' } })}
            draggable
            onDragStart={e => onDragStart(e, { id: `custom_${Date.now()}`, type: 'custom', data: { label: 'Мой режим' } })}
            style={itemStyle}
          >
            <span style={{ fontSize: 14 }}>＋</span>
            <span>Добавить свой</span>
          </button>
        </>
      )}

      {/* No results */}
      {q && MODE_GROUPS.every(g => {
        const meta = GROUP_TO_TYPE[g.id];
        return !meta || !g.items.some(i => i.name.toLowerCase().includes(q) || i.short.toLowerCase().includes(q));
      }) && (
        <div style={{ padding: '20px 14px', fontSize: 12.5, color: 'var(--text-faint)', textAlign: 'center' }}>
          Режим не найден
        </div>
      )}
    </div>
  );
}

function groupLabelStyle(labelColor: string): React.CSSProperties {
  return {
    padding: '10px 14px 4px',
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: labelColor,
  };
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '7px 14px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 12.5,
  color: 'var(--text)',
  textAlign: 'left',
  outline: 'none',
};
