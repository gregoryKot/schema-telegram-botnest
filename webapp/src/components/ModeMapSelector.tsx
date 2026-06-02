import { useEffect, useRef, useState } from 'react';
import { api, type ModeMapMeta, type ModeMapFull } from '../api';
import { ModeMapEditor } from './ModeMapEditor';

interface Props {
  clientId: number;
}

export function ModeMapSelector({ clientId }: Props) {
  const [maps, setMaps] = useState<ModeMapMeta[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeMap, setActiveMap] = useState<ModeMapFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

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

  async function createMap() {
    setCreating(true);
    try {
      const m = await api.createModeMap(clientId, `Карта ${maps.length + 1}`);
      setMaps(prev => [...prev, { id: m.id, title: m.title, createdAt: m.createdAt, updatedAt: m.updatedAt }]);
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
      {/* Map selector bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 12px 0',
        borderBottom: '1px solid rgba(var(--fg-rgb),0.07)',
        overflowX: 'auto', flexShrink: 0,
      }}>
        {maps.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {editingId === m.id ? (
              <input
                ref={titleRef}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={() => renameMap(m.id, editTitle)}
                onKeyDown={e => { if (e.key === 'Enter') renameMap(m.id, editTitle); if (e.key === 'Escape') setEditingId(null); }}
                style={{
                  fontSize: 13, fontWeight: 500, padding: '4px 8px',
                  borderRadius: 6, border: '1.5px solid var(--accent)',
                  background: 'var(--bg-elev)', color: 'var(--text)',
                  outline: 'none', width: 120,
                }}
                autoFocus
              />
            ) : (
              <button
                onClick={() => selectMap(m.id)}
                onDoubleClick={() => startEdit(m)}
                style={{
                  padding: '5px 12px', borderRadius: '6px 6px 0 0', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  border: `1px solid ${activeId === m.id ? 'rgba(var(--fg-rgb),0.1)' : 'transparent'}`,
                  borderBottom: activeId === m.id ? '1px solid var(--bg)' : '1px solid transparent',
                  background: activeId === m.id ? 'var(--bg)' : 'none',
                  color: activeId === m.id ? 'var(--text)' : 'var(--text-sub)',
                  marginBottom: activeId === m.id ? -1 : 0,
                }}
              >
                {m.title}
              </button>
            )}
            {activeId === m.id && maps.length > 1 && (
              <button onClick={() => deleteMap(m.id)}
                title="Удалить карту"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 12, padding: '0 2px 0 0', lineHeight: 1 }}>
                ✕
              </button>
            )}
          </div>
        ))}
        <button onClick={createMap} disabled={creating}
          style={{
            padding: '5px 10px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer', flexShrink: 0,
            border: '1px dashed rgba(var(--fg-rgb),0.2)', background: 'none',
            color: 'var(--text-sub)', whiteSpace: 'nowrap',
          }}>
          {creating ? '…' : '+ Новая карта'}
        </button>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-faint)', flexShrink: 0, paddingRight: 4 }}>
          двойной клик — переименовать
        </div>
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-faint)' }}>
            Загрузка…
          </div>
        )}
        {!loading && maps.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <div style={{ fontSize: 32 }}>🗺️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Нет карт режимов</div>
            <button onClick={createMap} style={{
              padding: '10px 24px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
              background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 500,
            }}>
              Создать первую карту
            </button>
          </div>
        )}
        {!loading && activeMap && (
          <ModeMapEditor
            key={activeMap.id}
            mapId={activeMap.id}
            initialNodes={activeMap.nodes}
            initialEdges={activeMap.edges}
          />
        )}
      </div>
    </div>
  );
}
