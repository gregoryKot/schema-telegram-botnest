import { useEffect, useRef, useState } from 'react';
import { api, reportClientError, type ClientConceptualization, type TherapyClientSummary, type UserId } from '../../../api';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { CONCEPT_COPING_NOTE_MAX } from '../../../../../shared/src/limits/textLimits';
import { COPING_STYLE } from '../../../../../shared/src/schemaTherapy/guide/copingStyles';
import { getSchemaById } from '../../../../../shared/src/schemaTherapy/schemaTherapyData';
import { normalizeSchemaLinks } from '../../../../../shared/src/therapy/conceptGraph/schemaLinks';
import { clientDisplayName } from '../../../../../shared/src/therapy/clientInitials';
import { useTr } from '../../../utils/addressForm';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { CrisisCard } from '../../CrisisCard';
import { Skeleton } from '../../Skeleton';
import { ConceptFullscreenSheet, type SheetBack } from '../ConceptFullscreenSheet';
import { applyCopingRemote, copingAddress, copingState, filterClients, type CopingAction, type CopingCell, type CopingTarget } from './copingMark';

type Picked = { id: UserId; name: string };

/** Отметка у выбранного клиента: схема случая с сервера; undefined — грузится, null — не загрузилась. */
function useRemoteTarget(client: Picked | null, cell: CopingCell): CopingTarget | null | undefined {
  const [concept, setConcept] = useState<{ row: ClientConceptualization | null } | null | undefined>(undefined);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    setConcept(undefined);
    api.getConceptualization(client.id).then((row) => { if (alive) setConcept({ row }); }, () => { if (alive) setConcept(null); });
    return () => { alive = false; };
  }, [client]);
  if (!client || !concept) return concept === null ? null : undefined;
  return {
    name: client.name,
    ...copingState(normalizeSchemaLinks(concept.row?.schemaLinks), cell),
    apply: async (action) => setConcept({ row: await applyCopingRemote(api, client.id, cell, action, concept.row) }),
  };
}

/** Клиенты терапевта с поиском; кому стиль уже отмечен — пометка, тап открывает правку. */
function CopingClientList({ cell, onPick }: { cell: CopingCell; onPick: (c: Picked) => void }) {
  const [clients, setClients] = useState<TherapyClientSummary[] | null | undefined>(undefined);
  const [marked, setMarked] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let alive = true;
    api.getTherapyClients().then((l) => { if (alive) setClients(l); }, () => { if (alive) setClients(null); });
    api.getGuideMarkClients(copingAddress(cell)).then((r) => { if (alive) setMarked(r.clientIds); }, () => {});
    return () => { alive = false; };
  }, [cell]);
  return (
    <fieldset className="pa-block pa-set">
      <legend className="ds-label">У кого</legend>
      {clients === undefined && <Skeleton height={44} />}
      {clients === null && <span className="tb-error" role="alert">Список клиентов не загрузился</span>}
      {clients?.length === 0 && <span className="ds-sub">Клиентов пока нет — отметка ложится в схему случая клиента.</span>}
      {clients && clients.length > 0 && (
        <input type="search" className="ds-input" placeholder="Поиск по имени" aria-label="Поиск клиента" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}
      {clients && filterClients(clients, query).map((c) => {
        const name = clientDisplayName(c);
        const already = marked.includes(String(c.telegramId));
        return (
          <button key={String(c.telegramId)} type="button" className="ds-btn ds-btn--secondary cm-client" onClick={() => onPick({ id: c.telegramId, name })}>
            <span>{name}</span>{already && <span className="ds-sub cm-already">уже отмечено</span>}
          </button>
        );
      })}
    </fieldset>
  );
}

/** Строка «как это у клиента» и кнопки: отметить, сохранить правку, снять. */
function CopingNoteForm({ target, onDone }: { target: CopingTarget; onDone: () => void }) {
  const tr = useTr();
  const [note, setNote] = useState(target.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const run = async (action: CopingAction) => {
    setBusy(true);
    setError('');
    try {
      await target.apply(action);
      setDone(action.kind === 'mark' ? `Отмечено у ${target.name}` : `Отметка у ${target.name} снята`);
    } catch {
      reportClientError({ message: 'guide coping mark failed', section: 'therapist.guide' });
      setError('Не удалось сохранить — отметка осталась как была');
    } finally {
      setBusy(false);
    }
  };
  if (done) {
    return (
      <div className="pa-block" role="status">
        <h2 className="pp-hero-title">{done}</h2>
        <div><button type="button" className="ds-btn" onClick={onDone}>Готово</button></div>
      </div>
    );
  }
  return (
    <>
      <div className="pa-block">
        <span className="ds-label">{target.marked ? `Отмечено у ${target.name}` : target.name}</span>
        <LimitedTextarea
          max={CONCEPT_COPING_NOTE_MAX} className="ds-textarea" rows={3} value={note} aria-label="Как это проявляется у клиента"
          placeholder="Как это проявляется у клиента — необязательно" onChange={(e) => setNote(e.target.value)}
        />
        <p className="ds-sub">{tr('Запись видна только тебе: клиент на схеме случая видит лишь знак стиля.', 'Запись видна только вам: клиент на схеме случая видит лишь знак стиля.')}</p>
        {detectCrisisAny(note) && <CrisisCard surface="schema" />}
      </div>
      {error && <div className="tb-error" role="alert">{error}</div>}
      <div className="cm-actions">
        <button type="button" className="ds-btn" disabled={busy} aria-busy={busy || undefined} onClick={() => void run({ kind: 'mark', note })}>
          {target.marked ? 'Сохранить' : 'Отметить'}
        </button>
        {target.marked && (
          <button type="button" className="ds-btn ds-btn--secondary" disabled={busy} onClick={() => void run({ kind: 'unmark' })}>Снять отметку</button>
        )}
      </div>
    </>
  );
}

/**
 * «Про клиента» на стиле копинга схемы (#1484): стиль ложится в схему случая клиента (schemaLinks.coping),
 * схемы там нет — добавляется. Из карточки клиента (`fixed`) — сразу этот клиент, иначе — выбор из списка.
 * Ложится поверх листа схемы или «Справочника»: та же панель, позже в DOM.
 */
export function CopingMarkSheet({ cell, fixed, onClose }: { cell: CopingCell; fixed?: CopingTarget; onClose: () => void }) {
  const back = useRef<SheetBack | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const remote = useRemoteTarget(fixed ? null : picked, cell);
  const target = fixed ?? remote;
  const style = COPING_STYLE[cell.style];
  const schema = getSchemaById(cell.schemaId)?.name ?? '';
  return (
    <ConceptFullscreenSheet title={`Про клиента: ${style.label}`} label="Про клиента" column={680} closeLabel="Закрыть" onClose={onClose} backRef={back} panel>
      <div className="gd-page pa-page">
        <div className="pa-block">
          <h2 className="pp-hero-title">{style.label} · {schema}</h2>
          <p className="ds-sub">Человек {style.gist}. Отметка ляжет в схему случая клиента: у схемы появится знак стиля, а если схемы там не было — она добавится.</p>
        </div>
        {!fixed && !picked && <CopingClientList cell={cell} onPick={setPicked} />}
        {(fixed || picked) && target === undefined && <Skeleton height={120} />}
        {target === null && <span className="tb-error" role="alert">Схема случая клиента не загрузилась</span>}
        {target && <CopingNoteForm key={target.name} target={target} onDone={() => back.current?.()} />}
      </div>
    </ConceptFullscreenSheet>
  );
}
