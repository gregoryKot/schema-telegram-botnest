import { useEffect, useRef, useState } from 'react';
import { MODE_GROUPS, getModeById } from '../schemaTherapyData';
import type { ModeMapNode, TherapistCustomMode } from '../api';
import { api } from '../api';
import { MMIcon } from './modeMapIcons';
import { DRAG_TYPE, GROUP_TO_TYPE, type NodeType } from './modeMapData';

// Maps a mode id → which palette group/type it belongs to (for client modes)
function findModeMeta(modeId: string): { type: NodeType; copingSubtype?: 'over' | 'avoid' | 'surr'; emoji: string; name: string } | null {
  for (const group of MODE_GROUPS) {
    const meta = GROUP_TO_TYPE[group.id];
    if (!meta) continue;
    const item = group.items.find(i => i.id === modeId);
    if (item) return { type: meta.type, copingSubtype: meta.copingSubtype, emoji: item.emoji, name: item.name };
  }
  return null;
}

// Clinical display order: child → critic → coping(×3) → healthy
const GROUP_ORDER = ['child', 'critic', 'coping_overcompensation', 'coping_avoidance', 'coping_surrender', 'healthy'];

interface Props {
  onAdd: (node: Omit<ModeMapNode, 'position'>) => void;
  onAddMany?: (nodes: Omit<ModeMapNode, 'position'>[]) => void;
  clientId: number;
}

export function ModeMapPalette({ onAdd, onAddMany, clientId }: Props) {
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [customModes, setCustomModes] = useState<TherapistCustomMode[]>([]);
  const [clientModeIds, setClientModeIds] = useState<string[]>([]);
  const [clientOpen, setClientOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('⬡');
  const [newType, setNewType] = useState<NodeType>('custom');
  const [newCopingSub, setNewCopingSub] = useState<'over' | 'avoid' | 'surr'>('over');
  const addInputRef = useRef<HTMLInputElement>(null);
  const addFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listCustomModes().then(setCustomModes).catch(() => {});
  }, []);

  // Modes already identified for this client (from conceptualization)
  useEffect(() => {
    api.getConceptualization(clientId)
      .then(c => setClientModeIds(Array.isArray(c?.modeIds) ? c.modeIds : []))
      .catch(() => {});
  }, [clientId]);

  const q = search.trim().toLowerCase();

  const makeNode = (modeId: string, type: NodeType, label: string, extra?: Partial<ModeMapNode['data']>): Omit<ModeMapNode, 'position'> => ({
    id: `${modeId}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, type, data: { modeId, label, ...extra },
  });

  // Build a node partial for a client's identified mode (library or grouped)
  const clientModeNode = (modeId: string): Omit<ModeMapNode, 'position'> | null => {
    const meta = findModeMeta(modeId);
    const lib = getModeById(modeId);
    if (!meta && !lib) return null;
    const name = meta?.name ?? lib?.name ?? modeId;
    const type = meta?.type ?? 'custom';
    const extra = meta?.copingSubtype ? { copingSubtype: meta.copingSubtype } : {};
    return makeNode(modeId, type, name, extra);
  };
  const clientModeEmoji = (modeId: string): string =>
    findModeMeta(modeId)?.emoji ?? getModeById(modeId)?.emoji ?? '◆';

  const onDragStart = (e: React.DragEvent, partial: Omit<ModeMapNode, 'position'>) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(partial));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const toggleGroup = (id: string) => setOpenGroups(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  async function saveCustomMode() {
    if (!newName.trim()) return;
    const m = await api.createCustomMode({ name: newName.trim(), emoji: newEmoji, nodeType: newType });
    setCustomModes(prev => [...prev, m]);
    setNewName(''); setNewEmoji('⬡'); setAdding(false);
  }

  function getCustomNodeData(m: TherapistCustomMode): Omit<ModeMapNode, 'position'>['data'] {
    const base: ModeMapNode['data'] = { label: m.name };
    if (m.nodeType === 'coping') {
      // Default to 'over' unless stored differently (future: store in model)
      base.copingSubtype = 'over';
    }
    return base;
  }

  async function removeCustomMode(id: number) {
    await api.deleteCustomMode(id);
    setCustomModes(prev => prev.filter(m => m.id !== id));
  }

  return (
    <div style={{
      width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--line)',
      background: 'var(--surface-2)',
    }}>
      {/* Search */}
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск режима…"
          style={{ width: '100%', padding: '6px 10px', borderRadius: 6, boxSizing: 'border-box',
            border: '1px solid var(--line-strong)', background: 'var(--bg-elev)',
            color: 'var(--text)', fontSize: 12.5, outline: 'none' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Client's identified modes (from conceptualization) — collapsible */}
        {!q && clientModeIds.length > 0 && (
          <div style={{ background: clientOpen ? 'var(--accent-soft)' : 'none', paddingBottom: clientOpen ? 4 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '7px 12px' }}>
              <button onClick={() => setClientOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', flex: 1, textAlign: 'left' }}>★ Режимы клиента</span>
                <span style={{ fontSize: 10, color: 'var(--accent)' }}>{clientOpen ? '▲' : `▼ ${clientModeIds.length}`}</span>
              </button>
              {onAddMany && (
                <button onClick={() => { const all = clientModeIds.map(clientModeNode).filter(Boolean) as Omit<ModeMapNode, 'position'>[]; if (all.length) onAddMany(all); }}
                  title="Вынести все режимы клиента на карту" aria-label="Вынести все режимы клиента на карту"
                  style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 3, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5,
                    cursor: 'pointer', fontSize: 10.5, fontWeight: 600, padding: '3px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  <MMIcon name="plus" size={11} /> все
                </button>
              )}
            </div>
            {clientOpen && clientModeIds.map(modeId => {
              const node = clientModeNode(modeId);
              if (!node) return null;
              return (
                <button key={modeId}
                  onClick={() => onAdd(node)}
                  draggable onDragStart={e => onDragStart(e, node)}
                  style={{ ...itemStyle, padding: '5px 14px' }} title="Из концептуализации клиента" aria-label="Из концептуализации клиента">
                  <span style={{ fontSize: 12 }}>{clientModeEmoji(modeId)}</span>
                  <span style={{ fontSize: 12, flex: 1 }}>{node.data.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Trigger + Behavior — the bookends of the cycle */}
        {(!q || 'триггер ситуация'.includes(q)) && (
          <button onClick={() => onAdd({ id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })}
            draggable onDragStart={e => onDragStart(e, { id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })}
            style={itemStyle} title="Внешняя ситуация, запускающая цикл" aria-label="Внешняя ситуация, запускающая цикл">
            <span style={{ fontSize: 12 }}>☁️</span>
            <span style={{ fontSize: 12.5, flex: 1 }}>Триггер / Ситуация</span>
          </button>
        )}
        {(!q || 'поведение последствие'.includes(q)) && (
          <button onClick={() => onAdd({ id: `behavior_${Date.now()}`, type: 'behavior', data: { label: 'Поведение' } })}
            draggable onDragStart={e => onDragStart(e, { id: `behavior_${Date.now()}`, type: 'behavior', data: { label: 'Поведение' } })}
            style={itemStyle} title="Что человек делает / последствие" aria-label="Что человек делает / последствие">
            <span style={{ fontSize: 12 }}>🎬</span>
            <span style={{ fontSize: 12.5, flex: 1 }}>Поведение / Последствие</span>
          </button>
        )}

        {/* Standard mode groups — child → critic → coping → healthy (clinical order) */}
        {[...MODE_GROUPS].sort((a, b) => GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id)).map(group => {
          const meta = GROUP_TO_TYPE[group.id];
          if (!meta) return null;
          const items = q
            ? group.items.filter(i => i.name.toLowerCase().includes(q) || i.short.toLowerCase().includes(q))
            : group.items;
          if (q && items.length === 0) return null;
          const isOpen = q ? true : openGroups.has(group.id);
          return (
            <div key={group.id}>
              <button onClick={() => !q && toggleGroup(group.id)}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '6px 12px',
                  background: 'none', border: 'none', cursor: q ? 'default' : 'pointer',
                  borderTop: '1px solid var(--line)' }}>
                <GroupDot type={meta.type} color={group.color} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-sub)', flex: 1, textAlign: 'left', marginLeft: 7 }}>
                  {group.group}
                </span>
                {!q && <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{isOpen ? '▲' : `▼ ${group.items.length}`}</span>}
              </button>
              {isOpen && items.map(item => (
                <button key={item.id}
                  onClick={() => onAdd(makeNode(item.id, meta.type, item.name, meta.copingSubtype ? { copingSubtype: meta.copingSubtype } : {}))}
                  draggable onDragStart={e => onDragStart(e, makeNode(item.id, meta.type, item.name, meta.copingSubtype ? { copingSubtype: meta.copingSubtype } : {}))}
                  style={itemStyle} title={item.short}>
                  <span style={{ fontSize: 12 }}>{item.emoji}</span>
                  <span style={{ fontSize: 12, flex: 1, lineHeight: 1.3 }}>{item.name}</span>
                </button>
              ))}
            </div>
          );
        })}

        {/* Custom therapist modes */}
        {!q && (
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px' }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-sub)', flex: 1 }}>Мои режимы</span>
              <button onClick={() => { const next = !adding; setAdding(next); if (next) setTimeout(() => { addFormRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); addInputRef.current?.focus(); }, 60); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                title="Добавить свой режим" aria-label="Добавить свой режим"><MMIcon name="plus" size={15} /></button>
            </div>

            {adding && (
              <div ref={addFormRef} style={{ padding: '6px 10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Emoji + name */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input ref={addInputRef} value={newEmoji} onChange={e => setNewEmoji(e.target.value)}
                    style={{ ...miniInputStyle, width: 34, textAlign: 'center', fontSize: 15 }} maxLength={2} />
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveCustomMode(); if (e.key === 'Escape') setAdding(false); }}
                    placeholder="Название…" style={{ ...miniInputStyle, flex: 1 }} />
                </div>

                {/* Shape picker — visual buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {([
                    { type: 'child' as NodeType,   label: 'Дет.',  shape: 'circle'  },
                    { type: 'critic' as NodeType,  label: 'Крит.', shape: 'oct'     },
                    { type: 'healthy' as NodeType, label: 'Здор.', shape: 'rect'    },
                    { type: 'custom' as NodeType,  label: 'Свой',  shape: 'rect2'   },
                  ]).map(opt => (
                    <button key={opt.type} onClick={() => setNewType(opt.type)}
                      title={opt.label}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        padding: '4px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 9,
                        border: `1.5px solid ${newType === opt.type && !(newType === 'coping') ? 'var(--accent)' : 'var(--line-strong)'}`,
                        background: newType === opt.type && !(newType === 'coping') ? 'var(--accent-soft)' : 'none',
                        color: newType === opt.type && !(newType === 'coping') ? 'var(--accent)' : 'var(--text-faint)',
                      }}>
                      <MiniShapePreview shape={opt.shape} />
                      {opt.label}
                    </button>
                  ))}
                  {/* Coping subtypes */}
                  {([
                    { sub: 'over' as const,  label: 'Гипер.', shape: 'penta'  },
                    { sub: 'avoid' as const, label: 'Избег.', shape: 'shield' },
                    { sub: 'surr' as const,  label: 'Капит.', shape: 'pill'   },
                  ]).map(opt => {
                    const active = newType === 'coping' && newCopingSub === opt.sub;
                    return (
                      <button key={opt.sub} onClick={() => { setNewType('coping'); setNewCopingSub(opt.sub); }}
                        title={opt.label}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                          padding: '4px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 9,
                          border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
                          background: active ? 'var(--accent-soft)' : 'none',
                          color: active ? 'var(--accent)' : 'var(--text-faint)',
                        }}>
                        <MiniShapePreview shape={opt.shape} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={saveCustomMode} style={{ ...miniInputStyle, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, flex: 1 }}>
                    Сохранить
                  </button>
                  <button onClick={() => setAdding(false)} style={{ ...miniInputStyle, cursor: 'pointer', flex: 0, padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MMIcon name="close" size={13} /></button>
                </div>
              </div>
            )}

            {customModes.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => onAdd({ id: `cm_${m.id}_${Date.now()}`, type: m.nodeType as NodeType, data: getCustomNodeData(m) })}
                  draggable onDragStart={e => onDragStart(e, { id: `cm_${m.id}_${Date.now()}`, type: m.nodeType as NodeType, data: getCustomNodeData(m) })}
                  style={{ ...itemStyle, flex: 1 }}>
                  <span style={{ fontSize: 13 }}>{m.emoji}</span>
                  <span style={{ fontSize: 12.5, flex: 1 }}>{m.name}</span>
                </button>
                <button onClick={() => removeCustomMode(m.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', padding: '0 10px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                  title="Удалить" aria-label="Удалить"><MMIcon name="close" size={11} /></button>
              </div>
            ))}

            {customModes.length === 0 && !adding && (
              <div style={{ padding: '4px 12px 10px', fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.4 }}>
                Добавь режимы, с которыми<br />работаешь чаще всего
              </div>
            )}
          </div>
        )}

        {/* Search no results */}
        {q && MODE_GROUPS.every(g => {
          const m = GROUP_TO_TYPE[g.id];
          return !m || !g.items.some(i => i.name.toLowerCase().includes(q) || i.short.toLowerCase().includes(q));
        }) && !customModes.some(m => m.name.toLowerCase().includes(q)) && (
          <div style={{ padding: '20px 14px', fontSize: 12.5, color: 'var(--text-faint)', textAlign: 'center' }}>
            Режим не найден
          </div>
        )}
      </div>
    </div>
  );
}

function GroupDot({ type, color }: { type: NodeType; color: string }) {
  if (type === 'child') return <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />;
  if (type === 'coping') return <div style={{ width: 10, height: 10, background: color, clipPath: 'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)', flexShrink: 0 }} />;
  return <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />;
}

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '6px 14px',
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text)', textAlign: 'left', outline: 'none',
};

const miniInputStyle: React.CSSProperties = {
  padding: '5px 8px', borderRadius: 5, fontSize: 12.5,
  border: '1px solid var(--line-strong)',
  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
};

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
