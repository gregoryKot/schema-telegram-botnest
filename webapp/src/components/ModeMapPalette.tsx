import { useEffect, useRef, useState } from 'react';
import { MODE_GROUPS, getModeById } from '../schemaTherapyData';
import { api, type ModeMapNode, type TherapistCustomMode } from '../api';
import { CUSTOM_MODE_NAME_MAX } from '../../../shared/src/limits/textLimits';
import { MMIcon } from './modeMapIcons';
import { DRAG_TYPE, GROUP_TO_TYPE, TYPE_COLORS, type NodeType } from './modeMapData';
import { IdentityDot } from '../../../shared/src/components/IdentityDot';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { useTr } from '../utils/addressForm';
import { ShapePicker } from './modeMap/ShapePicker';
import { ConceptPaletteItems } from './modeMap/ConceptPaletteItems';
import { ClientSchemasPalette } from './modeMap/ClientSchemasPalette';
import { useModeMapConcept } from './modeMap/clientConceptContext';
import { findModeMeta } from './modeMap/modeNodeMeta';
import { hueStyle, MODE_GROUP_HUE } from '../lib/tone';
import '../styles/sheet-modemap.css';

// Clinical display order: child → critic → coping(×3) → healthy
const GROUP_ORDER = ['child', 'critic', 'coping_overcompensation', 'coping_avoidance', 'coping_surrender', 'healthy'];

interface Props { onAdd: (node: Omit<ModeMapNode, 'position'>) => void; onAddMany?: (nodes: Omit<ModeMapNode, 'position'>[]) => void }

export function ModeMapPalette({ onAdd, onAddMany }: Props) {
  const tr = useTr();
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  // 'failed' ≠ пустой список — сбой загрузки не равен «режимов нет» (см. CLAUDE.md).
  const [customModes, setCustomModes] = useState<TherapistCustomMode[] | 'failed'>([]);
  // Режимы клиента (из концептуализации) приезжают из общего контекста карты — один запрос на карту.
  const concept = useModeMapConcept();
  const clientModeIds: string[] | 'failed' = concept === 'failed' ? 'failed' : concept?.modeIds ?? [];
  const [clientOpen, setClientOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('⬡');
  const [newType, setNewType] = useState<NodeType>('custom');
  const [newCopingSub, setNewCopingSub] = useState<'over' | 'avoid' | 'surr'>('over');
  const addInputRef = useRef<HTMLInputElement>(null);
  const addFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listCustomModes().then(setCustomModes).catch(() => setCustomModes('failed'));
  }, []);

  const q = search.trim().toLowerCase();
  const customModesList = Array.isArray(customModes) ? customModes : [];
  const clientModeList = Array.isArray(clientModeIds) ? clientModeIds : [];

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
  const clientModeColor = (modeId: string): string | undefined =>
    findModeMeta(modeId)?.color ?? getModeById(modeId)?.groupColor;

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
    setCustomModes(prev => [...(Array.isArray(prev) ? prev : []), m]);
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
    setCustomModes(prev => Array.isArray(prev) ? prev.filter(m => m.id !== id) : prev);
  }

  return (
    <div className="ds-card mm2-pal">
      {/* Search */}
      <div className="mm2-pal-search">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск режима…" className="ds-input" />
      </div>

      <div className="mm2-pal-scroll">
        {/* Client's identified modes (from conceptualization) — collapsible.
            Сбой загрузки показывается, а не молчит: раньше секция просто не
            рендерилась (условие было ...length > 0), и терапевт думал, что у
            клиента режимы не отмечены (карта режимов, три молчания). */}
        {!q && (clientModeIds === 'failed' || clientModeList.length > 0) && (
          <div className={`mm2-client${clientOpen ? ' is-open' : ''}`}>
            <div className="mm2-client-row">
              <button onClick={() => setClientOpen(o => !o)} className="mm2-pal-head">
                <span className="mm2-pal-head-name">Режимы клиента</span>
                <span className="mm2-pal-head-n">{clientModeIds === 'failed' ? '' : clientOpen ? '▲' : `▼ ${clientModeList.length}`}</span>
              </button>
              {onAddMany && clientModeIds !== 'failed' && (
                <button onClick={() => { const all = clientModeList.map(clientModeNode).filter(Boolean) as Omit<ModeMapNode, 'position'>[]; if (all.length) onAddMany(all); }}
                  title="Вынести все режимы клиента на карту" aria-label="Вынести все режимы клиента на карту"
                  className="ds-btn ds-btn--accent mm2-pal-add">
                  <MMIcon name="plus" size={11} /> все
                </button>
              )}
            </div>
            {clientModeIds === 'failed' ? (
              <div className="mm2-pal-sub is-err">Не удалось загрузить режимы клиента</div>
            ) : clientOpen && clientModeList.map(modeId => {
              const node = clientModeNode(modeId);
              if (!node) return null;
              return (
                <button key={modeId}
                  onClick={() => onAdd(node)}
                  draggable onDragStart={e => onDragStart(e, node)}
                  className="mm2-pal-item" title="Из концептуализации клиента" aria-label="Из концептуализации клиента">
                  {clientModeColor(modeId) ? <IdentityDot color={clientModeColor(modeId)} size={12} /> : <span>◆</span>}
                  <span className="mm2-pal-item-name">{node.data.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Trigger + Behavior — the bookends of the cycle */}
        {(!q || 'триггер ситуация'.includes(q)) && (
          <button onClick={() => onAdd({ id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })}
            draggable onDragStart={e => onDragStart(e, { id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })}
            className="mm2-pal-item is-lg" title="Внешняя ситуация, запускающая цикл" aria-label="Внешняя ситуация, запускающая цикл">
            <IdentityDot color={TYPE_COLORS.trigger} size={12} />
            <span className="mm2-pal-item-name">Триггер / Ситуация</span>
          </button>
        )}
        {(!q || 'поведение последствие'.includes(q)) && (
          <button onClick={() => onAdd({ id: `behavior_${Date.now()}`, type: 'behavior', data: { label: 'Поведение' } })}
            draggable onDragStart={e => onDragStart(e, { id: `behavior_${Date.now()}`, type: 'behavior', data: { label: 'Поведение' } })}
            className="mm2-pal-item is-lg" title="Что человек делает / последствие" aria-label="Что человек делает / последствие">
            <IdentityDot color={TYPE_COLORS.behavior} size={12} />
            <span className="mm2-pal-item-name">Поведение / Последствие</span>
          </button>
        )}

        {!q && <ClientSchemasPalette onAdd={onAdd} onDragStart={onDragStart} />}
        {!q && <ConceptPaletteItems onAdd={onAdd} onDragStart={onDragStart} />}

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
            <div key={group.id} style={hueStyle(MODE_GROUP_HUE[group.id])}>
              <button onClick={() => !q && toggleGroup(group.id)} className={`mm2-pal-head${q ? ' is-static' : ''}`}>
                <i className="ds-dot tone-fill" />
                <span className="mm2-pal-head-name">{group.group}</span>
                {!q && <span className="mm2-pal-head-n">{isOpen ? '▲' : `▼ ${group.items.length}`}</span>}
              </button>
              {isOpen && items.map(item => (
                <button key={item.id}
                  onClick={() => onAdd(makeNode(item.id, meta.type, item.name, meta.copingSubtype ? { copingSubtype: meta.copingSubtype } : {}))}
                  draggable onDragStart={e => onDragStart(e, makeNode(item.id, meta.type, item.name, meta.copingSubtype ? { copingSubtype: meta.copingSubtype } : {}))}
                  className="mm2-pal-item is-tone" title={item.short}>
                  <i className="ds-dot tone-fill" />
                  <span className="mm2-pal-item-name">{item.name}</span>
                </button>
              ))}
            </div>
          );
        })}

        {/* Custom therapist modes */}
        {!q && (
          <div className="mm2-mine">
            <div className="mm2-mine-head">
              <span className="mm2-pal-head-name">Мои режимы</span>
              <button onClick={() => { const next = !adding; setAdding(next); if (next) setTimeout(() => { scrollIntoViewSafe(addFormRef.current, { block: 'nearest' }); addInputRef.current?.focus(); }, 60); }}
                className="mm2-mine-plus"
                title="Добавить свой режим" aria-label="Добавить свой режим"><MMIcon name="plus" size={15} /></button>
            </div>

            {adding && (
              <div ref={addFormRef} className="mm2-add-form">
                {/* Emoji + name */}
                <div className="mm2-add-row">
                  <input ref={addInputRef} value={newEmoji} onChange={e => setNewEmoji(e.target.value)}
                    className="ds-input mm2-add-emoji" maxLength={2} />
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveCustomMode(); if (e.key === 'Escape') setAdding(false); }}
                    placeholder="Название…" maxLength={CUSTOM_MODE_NAME_MAX} className="ds-input" />
                </div>

                <ShapePicker newType={newType} newCopingSub={newCopingSub} setNewType={setNewType} setNewCopingSub={setNewCopingSub} />

                <div className="mm2-add-row">
                  <button onClick={saveCustomMode} className="ds-btn ds-btn--sm">Сохранить</button>
                  <button onClick={() => setAdding(false)} aria-label="Отменить" className="ds-btn ds-btn--icon ds-btn--sm"><MMIcon name="close" size={13} /></button>
                </div>
              </div>
            )}

            {customModesList.map(m => (
              <div key={m.id} className="mm2-mine-row">
                <button
                  onClick={() => onAdd({ id: `cm_${m.id}_${Date.now()}`, type: m.nodeType as NodeType, data: getCustomNodeData(m) })}
                  draggable onDragStart={e => onDragStart(e, { id: `cm_${m.id}_${Date.now()}`, type: m.nodeType as NodeType, data: getCustomNodeData(m) })}
                  className="mm2-pal-item is-lg">
                  <span>{m.emoji}</span>
                  <span className="mm2-pal-item-name">{m.name}</span>
                </button>
                <button onClick={() => removeCustomMode(m.id)} className="mm2-mine-del"
                  title="Удалить" aria-label="Удалить"><MMIcon name="close" size={11} /></button>
              </div>
            ))}

            {customModes === 'failed' && (
              <div className="mm2-pal-sub is-err">
                {tr('Не удалось загрузить твои режимы', 'Не удалось загрузить ваши режимы')}
              </div>
            )}
            {customModes !== 'failed' && customModesList.length === 0 && !adding && (
              <div className="mm2-pal-sub">
                {tr('Добавь режимы, с которыми', 'Добавьте режимы, с которыми')}<br />{tr('работаешь чаще всего', 'работаете чаще всего')}
              </div>
            )}
          </div>
        )}

        {/* Search no results */}
        {q && MODE_GROUPS.every(g => {
          const m = GROUP_TO_TYPE[g.id];
          return !m || !g.items.some(i => i.name.toLowerCase().includes(q) || i.short.toLowerCase().includes(q));
        }) && !customModesList.some(m => m.name.toLowerCase().includes(q)) && (
          <div className="mm2-pal-empty">Режим не найден</div>
        )}
      </div>
    </div>
  );
}
