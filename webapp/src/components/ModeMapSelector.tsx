import { useEffect, useRef, useState } from 'react';
import { api, type ModeMapMeta, type ModeMapFull, type ModeMapKind, type UserId } from '../api';
import { ModeMapEditor } from './ModeMapEditor';
import { ModeMapSkeleton } from './modeMap/ModeMapSkeleton';
import { useCanvasTop } from './modeMap/useCanvasTop';
import { Dropdown } from './Dropdown';
import { MMIcon } from './modeMapIcons';
import { useTr } from '../utils/addressForm';
import '../styles/sheet-modemap.css';
import { HistoryConfirmDialog } from './HistoryConfirmDialog';
import { RenameDeleteMenu } from './RenameDeleteMenu';
import { MODE_MAP_TITLE_MAX } from '../../../shared/src/limits/textLimits';
import { KIND_META } from './modeMap/mapKinds';
import { MapKindPicker } from './modeMap/MapKindPicker';
import { useNewMap } from './modeMap/useNewMap';
import { PaperEmpty } from './art/PaperEmpty';
import { Cluster } from './art/PaperArtSigns';

interface Props { clientId: UserId; initialMapId?: number }  // initialMapId: карта, которую открыть первой (иначе первая в списке)

export function ModeMapSelector({ clientId, initialMapId }: Props) {
  const tr = useTr();
  const [maps, setMaps] = useState<ModeMapMeta[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeMap, setActiveMap] = useState<ModeMapFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickKind, setPickKind] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const newBtnRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useCanvasTop(bodyRef);

  // Reset to the loading state when the viewed client changes: adjusting state
  // during render (not in an effect) is the documented pattern for a changing prop.
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

  const newMap = useNewMap(clientId, maps, (m) => {
    setMaps(prev => [...prev, { id: m.id, title: m.title, kind: m.kind, createdAt: m.createdAt, updatedAt: m.updatedAt }]);
    setActiveId(m.id);
    setActiveMap(m);
  });
  const createMap = (kind: ModeMapKind) => { setPickKind(false); void newMap.create(kind); };
  const creating = newMap.creating;

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
    const t = title.trim() || KIND_META[maps.find(m => m.id === id)?.kind ?? 'free'].label;
    await api.updateModeMap(id, { title: t });
    setMaps(prev => prev.map(m => m.id === id ? { ...m, title: t } : m));
    setEditingId(null);
  }

  function startEdit(m: ModeMapMeta) {
    setEditingId(m.id); setEditTitle(m.title);
    setTimeout(() => titleRef.current?.select(), 50);
  }

  const activeMeta = maps.find(m => m.id === activeId);

  return (
    <div className="mm2-fill">
      {/* Map selector bar — pill-style tabs */}
      <div className="mm2-bar">
        <div className="ds-seg ds-seg--scroll" role="group" aria-label="Графические карты">
          {maps.map(m => editingId === m.id ? (
            <input
              key={m.id}
              ref={titleRef} maxLength={MODE_MAP_TITLE_MAX}
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => renameMap(m.id, editTitle)}
              onKeyDown={e => { if (e.key === 'Enter') renameMap(m.id, editTitle); if (e.key === 'Escape') setEditingId(null); }}
              className="ds-input ds-input--sm mm2-rename"
            />
          ) : (
            <button
              key={m.id} type="button"
              aria-pressed={activeId === m.id}
              onClick={() => selectMap(m.id)}
              title={KIND_META[m.kind]?.label}
              className={`ds-seg-btn${activeId === m.id ? ' is-active' : ''}`}
            >
              {m.title}
            </button>
          ))}
        </div>
        {activeMeta && <RenameDeleteMenu label="Действия с картой" deleteLabel="Удалить карту" onRename={() => startEdit(activeMeta)} onDelete={maps.length > 1 ? () => setDeleteTargetId(activeMeta.id) : undefined} />}
        <button ref={newBtnRef} onClick={() => setPickKind(o => !o)} disabled={creating}
          className={`ds-btn ds-btn--secondary ds-btn--sm mm2-new${pickKind ? ' is-active' : ''}`}>
          {creating ? '…' : (
            <span>
              <MMIcon name="plus" size={13} />Новая карта<MMIcon name="caret" size={11} className="mm2-tb-caret" />
            </span>
          )}
        </button>
      </div>

      {/* Тип новой карты: общее меню Dropdown прижимает себя к краям экрана (T-6) */}
      {pickKind && (
        <Dropdown anchorRef={newBtnRef} width={290} className="mm2-kind-menu" onClose={() => setPickKind(false)}>
          <MapKindPicker variant="menu" concept={newMap.concept} onPick={createMap} />
        </Dropdown>
      )}

      {newMap.failed && (
        <p role="alert" className="mm2-create-err">{tr('Не получилось создать карту. Попробуй ещё раз.', 'Не получилось создать карту. Попробуйте ещё раз.')}</p>
      )}
      {/* Editor area */}
      <div ref={bodyRef} className="mm2-body">
        {loading && <ModeMapSkeleton />}
        {!loading && maps.length === 0 && (
          <div className="mm2-center">
            <PaperEmpty art={Cluster} title="Пока нет графических карт">{tr('Выбери тип первой карты', 'Выберите тип первой карты')}</PaperEmpty>
            <div className="mm2-kinds">
              <MapKindPicker variant="cards" concept={newMap.concept} disabled={creating} onPick={createMap} />
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
        <HistoryConfirmDialog
          title="Удалить карту?"
          message="Это действие нельзя отменить."
          confirmLabel="Удалить"
          onConfirm={() => deleteMap(deleteTargetId)}
          onCancel={() => setDeleteTargetId(null)}
        />
      )}
    </div>
  );
}
