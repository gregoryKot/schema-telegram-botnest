import { useState } from 'react';
import { MODE_GROUPS } from '../schemaTherapyData';
import type { ModeMapNode } from '../api';

type NodeType = ModeMapNode['type'];

export const DRAG_TYPE = 'application/modemap-node';

const GROUP_TO_TYPE: Record<string, { type: NodeType; color: string }> = {
  child:                   { type: 'child',   color: 'var(--accent-blue)' },
  coping_surrender:        { type: 'coping',  color: '#94a3b8' },
  coping_avoidance:        { type: 'coping',  color: 'var(--accent)' },
  coping_overcompensation: { type: 'coping',  color: 'var(--accent-orange)' },
  critic:                  { type: 'critic',  color: 'var(--accent-red)' },
  healthy:                 { type: 'healthy', color: 'var(--accent-green)' },
};

interface Props { onAdd: (node: Omit<ModeMapNode, 'position'>) => void; }

export function ModeMapPalette({ onAdd }: Props) {
  const [search, setSearch] = useState('');
  // Default: groups collapsed except first open
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());

  const q = search.trim().toLowerCase();

  const makeNode = (modeId: string, type: NodeType, label: string): Omit<ModeMapNode, 'position'> => ({
    id: `${modeId}_${Date.now()}`, type, data: { modeId, label },
  });

  const onDragStart = (e: React.DragEvent, partial: Omit<ModeMapNode, 'position'>) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(partial));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const toggleGroup = (id: string) => setOpenGroups(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div style={{
      width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid rgba(var(--fg-rgb),0.07)',
      background: 'rgba(var(--fg-rgb),0.015)',
    }}>
      {/* Search */}
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)', flexShrink: 0 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск режима…"
          style={{ width: '100%', padding: '6px 10px', borderRadius: 6, boxSizing: 'border-box',
            border: '1px solid rgba(var(--fg-rgb),0.14)', background: 'var(--bg-elev)',
            color: 'var(--text)', fontSize: 12.5, outline: 'none' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Trigger */}
        {(!q || 'триггер'.includes(q)) && (
          <button
            onClick={() => onAdd({ id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })}
            draggable onDragStart={e => onDragStart(e, { id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })}
            style={itemStyle}>
            <span style={{ fontSize: 13 }}>☁️</span>
            <span style={{ fontSize: 12.5, flex: 1 }}>Триггер</span>
          </button>
        )}

        {/* Mode groups */}
        {MODE_GROUPS.map(group => {
          const meta = GROUP_TO_TYPE[group.id];
          if (!meta) return null;

          const items = q
            ? group.items.filter(i => i.name.toLowerCase().includes(q) || i.short.toLowerCase().includes(q))
            : group.items;

          if (q && items.length === 0) return null;

          const isOpen = q ? true : openGroups.has(group.id);

          return (
            <div key={group.id}>
              {/* Group header */}
              <button onClick={() => !q && toggleGroup(group.id)}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '7px 12px',
                  background: 'none', border: 'none', cursor: q ? 'default' : 'pointer',
                  borderTop: '1px solid rgba(var(--fg-rgb),0.05)' }}>
                <div style={{ width: 10, height: 10, borderRadius: meta.type === 'child' ? '50%' :
                  meta.type === 'coping' ? 0 : 2,
                  clipPath: meta.type === 'coping' ? 'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)' : undefined,
                  background: group.color, flexShrink: 0, marginRight: 7,
                }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-sub)', flex: 1, textAlign: 'left' }}>
                  {group.group}
                </span>
                {!q && (
                  <span style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 4 }}>
                    {isOpen ? '▲' : `▼ ${group.items.length}`}
                  </span>
                )}
              </button>

              {/* Items */}
              {isOpen && items.map(item => (
                <button key={item.id}
                  onClick={() => onAdd(makeNode(item.id, meta.type, item.name))}
                  draggable onDragStart={e => onDragStart(e, makeNode(item.id, meta.type, item.name))}
                  style={itemStyle} title={item.short}>
                  <span style={{ fontSize: 12 }}>{item.emoji}</span>
                  <span style={{ fontSize: 12, flex: 1, textAlign: 'left', lineHeight: 1.3 }}>{item.name}</span>
                </button>
              ))}
            </div>
          );
        })}

        {/* Custom */}
        {!q && (
          <div>
            <div style={{ borderTop: '1px solid rgba(var(--fg-rgb),0.05)', padding: '7px 12px 4px',
              fontSize: 11.5, fontWeight: 600, color: 'var(--text-sub)' }}>Свой режим</div>
            <button
              onClick={() => onAdd({ id: `custom_${Date.now()}`, type: 'custom', data: { label: 'Мой режим' } })}
              draggable onDragStart={e => onDragStart(e, { id: `custom_${Date.now()}`, type: 'custom', data: { label: 'Мой режим' } })}
              style={itemStyle}>
              <span style={{ fontSize: 14 }}>＋</span>
              <span style={{ fontSize: 12.5, flex: 1 }}>Добавить свой</span>
            </button>
          </div>
        )}

        {q && MODE_GROUPS.every(g => {
          const m = GROUP_TO_TYPE[g.id];
          return !m || !g.items.some(i => i.name.toLowerCase().includes(q) || i.short.toLowerCase().includes(q));
        }) && (
          <div style={{ padding: '20px 14px', fontSize: 12.5, color: 'var(--text-faint)', textAlign: 'center' }}>
            Режим не найден
          </div>
        )}
      </div>
    </div>
  );
}

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '6px 14px',
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text)', textAlign: 'left', outline: 'none',
};
