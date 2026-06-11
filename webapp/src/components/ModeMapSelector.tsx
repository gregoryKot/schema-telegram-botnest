import { useEffect, useRef, useState } from 'react';
import { api, type ModeMapMeta, type ModeMapFull, type ModeMapKind } from '../api';
import { ModeMapEditor } from './ModeMapEditor';
import { MMIcon } from './modeMapIcons';

interface Props {
  clientId: number;
}

const KIND_META: Record<ModeMapKind, { icon: string; label: string; hint: string }> = {
  personality: { icon: '🧭', label: 'Карта личности',  hint: 'Все основные режимы человека на одной странице — для общей ориентации' },
  problem:     { icon: '🎯', label: 'Карта ситуации',  hint: 'Конкретная цепочка: триггер → режимы → последствия' },
};

export function ModeMapSelector({ clientId }: Props) {
  const [maps, setMaps] = useState<ModeMapMeta[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeMap, setActiveMap] = useState<ModeMapFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pickKind, setPickKind] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const newBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  function openKindPicker() {
    const r = newBtnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ x: r.left, y: r.bottom + 4 });
    setPickKind(o => !o);
  }

  // Load list on mount
  useEffect(() => {
    setLoading(true);
    api.listModeMaps(clientId)
      .then(list => {
        setMaps(list);
        if (list.length > 0) selectMap(list[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  async function selectMap(id: number) {
    if (activeId === id) return;
    setActiveId(id);
    setLoading(true);
    try {
      const full = await api.getModeMap(id);
      setActiveMap(full);
    } finally { setLoading(false); }
  }

  async function createMap(kind: ModeMapKind) {
    setCreating(true); setPickKind(false);
    try {
      const title = kind === 'personality' ? 'Карта личности' : `Ситуация ${maps.filter(m => m.kind === 'problem').length + 1}`;
      const m = await api.createModeMap(clientId, title, kind);
      setMaps(prev => [...prev, { id: m.id, title: m.title, kind: m.kind, createdAt: m.createdAt, updatedAt: m.updatedAt }]);
      setActiveId(m.id);
      setActiveMap(m);
    } finally { setCreating(false); }
  }

  async function deleteMap(id: number) {
    if (!window.confirm('Удалить карту режимов? Это действие нельзя отменить.')) return;
    await api.deleteModeMap(id);
    const newMaps = maps.filter(m => m.id !== id);
    setMaps(newMaps);
    if (activeId === id) {
      if (newMaps.length > 0) selectMap(newMaps[0].id);
      else { setActiveId(null); setActiveMap(null); }
    }
  }

  async function renameMap(id: number, title: string) {
    const t = title.trim() || 'Карта режимов';
    await api.updateModeMap(id, { title: t });
    setMaps(prev => prev.map(m => m.id === id ? { ...m, title: t } : m));
    setEditingId(null);
  }

  function startEdit(m: ModeMapMeta) {
    setEditingId(m.id); setEditTitle(m.title);
    setTimeout(() => titleRef.current?.select(), 50);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Map selector bar — pill-style tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '8px 12px',
        borderBottom: '1px solid var(--line)',
        overflowX: 'auto', flexShrink: 0, minHeight: 42,
      }}>
        {maps.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 0 }}>
            {editingId === m.id ? (
              <input
                ref={titleRef}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={() => renameMap(m.id, editTitle)}
                onKeyDown={e => { if (e.key === 'Enter') renameMap(m.id, editTitle); if (e.key === 'Escape') setEditingId(null); }}
                style={{
                  fontSize: 13, fontWeight: 500, padding: '4px 8px', borderRadius: 6,
                  border: '1.5px solid var(--accent)', background: 'var(--bg-elev)',
                  color: 'var(--text)', outline: 'none', width: 120,
                }}
                autoFocus
              />
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center',
                borderRadius: 7, overflow: 'hidden',
                background: activeId === m.id ? 'var(--surface-3)' : 'none',
                border: activeId === m.id ? '1px solid var(--line)' : '1px solid transparent',
              }}>
                <button
                  onClick={() => selectMap(m.id)}
                  onDoubleClick={() => startEdit(m)}
                  title={`${KIND_META[m.kind]?.label ?? ''} · двойной клик — переименовать`}
                  style={{
                    padding: maps.length > 1 && activeId === m.id ? '4px 6px 4px 12px' : '4px 12px',
                    fontSize: 13, fontWeight: activeId === m.id ? 600 : 400,
                    cursor: 'pointer', whiteSpace: 'nowrap', background: 'none',
                    border: 'none', color: activeId === m.id ? 'var(--text)' : 'var(--text-sub)',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ fontSize: 12 }}>{KIND_META[m.kind]?.icon ?? '🗺️'}</span>
                  {m.title}
                </button>
                {maps.length > 1 && activeId === m.id && (
                  <button onClick={() => deleteMap(m.id)} title="Удалить карту"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-faint)', fontSize: 11, padding: '4px 8px 4px 2px',
                      lineHeight: 1, display: 'flex', alignItems: 'center',
                    }}>
                    <MMIcon name="close" size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <button ref={newBtnRef} onClick={openKindPicker} disabled={creating}
          style={{
            padding: '4px 10px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', flexShrink: 0,
            border: '1px dashed var(--line-strong)', background: pickKind ? 'var(--accent-soft)' : 'none',
            color: pickKind ? 'var(--accent)' : 'var(--text-faint)', whiteSpace: 'nowrap', marginLeft: 2,
          }}>
          {creating ? '…' : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <MMIcon name="plus" size={13} />Новая карта<MMIcon name="caret" size={11} style={{ opacity: 0.6 }} />
            </span>
          )}
        </button>
      </div>

      {/* Kind picker — fixed so the tab bar's overflow can't clip it */}
      {pickKind && menuPos && (
        <>
          <div onClick={() => setPickKind(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{
            position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 61, width: 280,
            background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 8,
            padding: 5, boxShadow: 'var(--shadow-2)',
          }}>
            {(['personality', 'problem'] as ModeMapKind[]).map(k => (
              <button key={k} onClick={() => createMap(k)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                  borderRadius: 6, cursor: 'pointer', background: 'none', border: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  <span>{KIND_META[k].icon}</span>{KIND_META[k].label}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-sub)', marginTop: 3, lineHeight: 1.35 }}>{KIND_META[k].hint}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Editor area */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-faint)' }}>
            Загрузка…
          </div>
        )}
        {!loading && maps.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}><MMIcon name="map" size={26} /></div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Нет карт режимов</div>
            <div style={{ fontSize: 13, color: 'var(--text-sub)', maxWidth: 360, textAlign: 'center', lineHeight: 1.45 }}>
              Выбери тип первой карты
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              {(['personality', 'problem'] as ModeMapKind[]).map(k => (
                <button key={k} onClick={() => createMap(k)} disabled={creating}
                  style={{ width: 200, padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    background: 'var(--bg-elev)', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{KIND_META[k].icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{KIND_META[k].label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 5, lineHeight: 1.4 }}>{KIND_META[k].hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {!loading && activeMap && (
          <ModeMapEditor
            key={activeMap.id}
            mapId={activeMap.id}
            clientId={clientId}
            kind={activeMap.kind}
            initialNodes={activeMap.nodes}
            initialEdges={activeMap.edges}
          />
        )}
      </div>
    </div>
  );
}
