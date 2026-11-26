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
import { MapTabs } from './modeMap/MapTabs';
import { useNewMap } from './modeMap/useNewMap';

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
  // Отказ открыть, переименовать или удалить карту виден терапевту (до 2026-11 промисы шли без catch, нашёл no-floating-promises).
  const [mapFail, setMapFail] = useState<'open' | 'rename' | 'delete' | null>(null);
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

  // back — карта, которая остаётся в редакторе при отказе: вкладка подсвечивает то, что открыто, а не то, что не загрузилось.
  async function selectMap(id: number, back: ModeMapFull | null = activeMap) {
    if (activeId === id) return;
    setActiveId(id);
    setLoading(true);
    setMapFail(null);
    try {
      const full = await api.getModeMap(id);
      setActiveMap(full);
    } catch {
      setActiveId(back?.id ?? null); setActiveMap(back); setMapFail('open');
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
    setMapFail(null);
    try { await api.deleteModeMap(id); } catch { setMapFail('delete'); return; } // карта на месте — и на экране тоже
    const newMaps = maps.filter(m => m.id !== id);
    setMaps(newMaps);
    if (activeId === id) {
      if (newMaps.length > 0) void selectMap(newMaps[0].id, null); // сбой ловит сам: mapFail; удалённую карту не возвращает
      else { setActiveId(null); setActiveMap(null); }
    }
  }

  async function renameMap(id: number, title: string) {
    const t = title.trim() || KIND_META[maps.find(m => m.id === id)?.kind ?? 'free'].label;
    setMapFail(null);
    try { await api.updateModeMap(id, { title: t }); } catch { setMapFail('rename'); return; } // поле остаётся открытым с введённым текстом
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
        <MapTabs maps={maps} activeId={activeId} editingId={editingId} onSelect={id => void selectMap(id)} renderEdit={m => (
          <input
            key={m.id}
            ref={titleRef} maxLength={MODE_MAP_TITLE_MAX}
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={() => renameMap(m.id, editTitle)}
            onKeyDown={e => { if (e.key === 'Enter') void renameMap(m.id, editTitle); /* сбой ловит сам: mapFail */ if (e.key === 'Escape') setEditingId(null); }}
            className="ds-input ds-input--sm mm2-rename"
          />
        )} />
        {activeMeta && <RenameDeleteMenu label="Действия с картой" deleteLabel="Удалить карту" onRename={() => startEdit(activeMeta)} onDelete={maps.length > 1 ? () => setDeleteTargetId(activeMeta.id) : undefined} />}
        <button ref={newBtnRef} onClick={() => setPickKind(o => !o)} disabled={creating} aria-busy={creating || undefined}
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
      {mapFail && (
        <p role="alert" className="mm2-create-err">
          {mapFail === 'open' ? 'Не получилось открыть карту.' : mapFail === 'rename' ? 'Не получилось переименовать карту.' : 'Не получилось удалить карту.'}{' '}
          {tr('Попробуй ещё раз.', 'Попробуйте ещё раз.')}
        </p>
      )}
      {/* Editor area */}
      <div ref={bodyRef} className="mm2-body">
        {loading && <ModeMapSkeleton />}
        {!loading && maps.length === 0 && (
          <div className="mm2-center mm2-center--kinds">{/* без знака у заголовка: Cluster уже стоит в плитке «Карта режимов» */}
            <div className="mm2-kinds-head">
              <p className="ds-list-title">Пока нет графических карт</p>
              <p className="ds-empty">{tr('Выбери тип первой карты', 'Выберите тип первой карты')}</p>
            </div>
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
