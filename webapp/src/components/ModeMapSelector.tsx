import { useEffect, useRef, useState } from 'react';
import { api, type ModeMapMeta, type ModeMapFull, type ModeMapKind, type UserId } from '../api';
import { ModeMapEditor } from './ModeMapEditor';
import { MMIcon } from './modeMapIcons';
import { useTr } from '../utils/addressForm';
import '../styles/sheet-modemap.css';
import { ConfirmDialog } from './ConfirmDialog';
import { MODE_MAP_TITLE_MAX } from '../../../shared/src/limits/textLimits';

interface Props { clientId: UserId; initialMapId?: number }  // initialMapId: карта, которую открыть первой (иначе первая в списке)

const KIND_META: Record<ModeMapKind, { label: string; hint: string }> = {
  personality: { label: 'Карта личности',  hint: 'Все основные режимы человека на одной странице — для общей ориентации' },
  problem:     { label: 'Карта ситуации',  hint: 'Конкретная цепочка: триггер → режимы → последствия' },
  couple:      { label: 'Карта пары',      hint: 'Цикл-клэш: как копинг одного партнёра запускает боль другого' },
};
const KINDS: ModeMapKind[] = ['personality', 'problem', 'couple'];

export function ModeMapSelector({ clientId, initialMapId }: Props) {
  const tr = useTr();
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

  // Reset to the loading state when the viewed client changes. Adjusting state
  // during render (not in an effect) is the documented pattern for deriving
  // fresh state from a changing prop — no set-state-in-effect needed.
  const [seenClient, setSeenClient] = useState(clientId);
  if (clientId !== seenClient) { setSeenClient(clientId); setLoading(true); }

  // Load the client's maps on mount / client change, then auto-open initialMapId (if it is in the list) or the first.
  // The whole load lives inside the effect (setState only after `await`, guarded by `alive`),
  // so deps are complete and nothing sets state synchronously in the effect body.
  useEffect(() => {
    let alive = true;
    api.listModeMaps(clientId)
      .then(async (list) => {
        if (!alive) return;
        setMaps(list);
        const first = list.find(m => m.id === initialMapId) ?? list[0];
        if (first) {
          const full = await api.getModeMap(first.id);
          if (!alive) return;
          setActiveId(first.id);
          setActiveMap(full);
        }
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [clientId, initialMapId]);

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
      const title = kind === 'personality' ? 'Карта личности'
        : kind === 'couple' ? `Пара ${maps.filter(m => m.kind === 'couple').length + 1}`
        : `Ситуация ${maps.filter(m => m.kind === 'problem').length + 1}`;
      const m = await api.createModeMap(clientId, title, kind);
      setMaps(prev => [...prev, { id: m.id, title: m.title, kind: m.kind, createdAt: m.createdAt, updatedAt: m.updatedAt }]);
      setActiveId(m.id);
      setActiveMap(m);
    } finally { setCreating(false); }
  }

  // Ж4 (аудит 2026-08): нативный confirm() заменён на ConfirmDialog —
  // deleteTargetId хранит id карты, которую подтверждаем (null = закрыт).
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  async function deleteMap(id: number) {
    setDeleteTargetId(null);
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
    <div className="mm2-fill">
      {/* Map selector bar — pill-style tabs */}
      <div className="mm2-bar">
        {maps.map(m => (
          <div key={m.id} className="mm2-tb">
            {editingId === m.id ? (
              <input
                ref={titleRef} maxLength={MODE_MAP_TITLE_MAX}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={() => renameMap(m.id, editTitle)}
                onKeyDown={e => { if (e.key === 'Enter') renameMap(m.id, editTitle); if (e.key === 'Escape') setEditingId(null); }}
                className="ds-input mm2-rename"
              />
            ) : (
              <div className={`ds-card mm2-map${activeId === m.id ? ' is-active' : ''}`}>
                <button
                  onClick={() => selectMap(m.id)}
                  onDoubleClick={() => startEdit(m)}
                  title={`${KIND_META[m.kind]?.label ?? ''} · двойной клик — переименовать`}
                  className={`mm2-map-btn${maps.length > 1 && activeId === m.id ? ' has-x' : ''}`}
                >
                  {m.title}
                </button>
                {maps.length > 1 && activeId === m.id && (
                  <button onClick={() => setDeleteTargetId(m.id)} title="Удалить карту" aria-label="Удалить карту" className="mm2-map-x">
                    <MMIcon name="close" size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <button ref={newBtnRef} onClick={openKindPicker} disabled={creating}
          className={`ds-btn ds-btn--secondary mm2-new${pickKind ? ' is-active' : ''}`}>
          {creating ? '…' : (
            <span>
              <MMIcon name="plus" size={13} />Новая карта<MMIcon name="caret" size={11} className="mm2-tb-caret" />
            </span>
          )}
        </button>
      </div>

      {/* Kind picker — fixed so the tab bar's overflow can't clip it */}
      {pickKind && menuPos && (
        <>
          <div role="button" tabIndex={0} aria-label="Закрыть"
            onClick={() => setPickKind(false)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPickKind(false); } }}
            className="mm2-backdrop" style={{ zIndex: 60 }} />
          <div className="ds-card mm2-kind-menu" style={{ left: menuPos.x, top: menuPos.y }}>
            {KINDS.map(k => (
              <button key={k} onClick={() => createMap(k)} className="mm2-item">
                <div className="mm2-kind-name">{KIND_META[k].label}</div>
                <div className="mm2-kind-hint">{KIND_META[k].hint}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Editor area */}
      <div className="mm2-body">
        {loading && <div className="mm2-loading">Загрузка…</div>}
        {!loading && maps.length === 0 && (
          <div className="mm2-center">
            <div className="mm2-empty-ico"><MMIcon name="map" size={26} /></div>
            <div className="mm2-empty-title">Нет карт режимов</div>
            <div className="mm2-empty-sub">
              {tr('Выбери тип первой карты', 'Выберите тип первой карты')}
            </div>
            <div className="mm2-kinds">
              {KINDS.map(k => (
                <button key={k} onClick={() => createMap(k)} disabled={creating} className="ds-card ds-card--hover mm2-kind-card">
                  <div className="mm2-kind-name">{KIND_META[k].label}</div>
                  <div className="mm2-kind-hint">{KIND_META[k].hint}</div>
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
      {deleteTargetId !== null && (
        <ConfirmDialog
          title="Удалить карту режимов?"
          message="Это действие нельзя отменить."
          confirmLabel="Удалить"
          onConfirm={() => deleteMap(deleteTargetId)}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
}
