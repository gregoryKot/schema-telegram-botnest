import { useEffect, useRef, useState } from 'react';
import { api, type TherapyClientSummary } from '../../../../api';
import { LimitedTextarea } from '../../../../../../shared/src/components/LimitedTextarea';
import { GUIDE_MARK_NOTE_MAX } from '../../../../../../shared/src/limits/textLimits';
import { clientDisplayName } from '../../../../../../shared/src/therapy/clientInitials';
import type { GuideMark } from '../../../../../../shared/src/therapy/guideMarks/guideMarksApi';
import { detectCrisisAny } from '../../../../utils/crisisMarkers';
import { findMark } from './guideMarkModel';
import { todayStr } from '../../../../utils/format';
import { CrisisCard } from '../../../CrisisCard';
import { Skeleton, SkeletonList } from '../../../Skeleton';
import { ConceptFullscreenSheet, type SheetBack } from '../../ConceptFullscreenSheet';
import { matchesRosterSearch, sortRoster } from '../../rosterOrder';
import { useTherapyClientList } from '../../useTherapyClientList';
import type { GuideMarkClient } from './useClientGuideMarks';

interface Props {
  address: string;
  /** «Покорность · В кабинете». */
  title: string;
  /** Справочник из карточки клиента: отметка сразу его, без выбора. */
  client?: GuideMarkClient;
  /** Выделенный текст: в карточку ляжет он, а не раздел целиком. */
  fragment?: string;
  /** Уже отмеченный этому клиенту раздел — правка его записи. */
  existing?: GuideMark;
  onSave: (client: GuideMarkClient, note: string) => void;
  onRemove: (mark: GuideMark, client: GuideMarkClient) => void;
  onClose: () => void;
}

// Выбранный клиент; existing: undefined — его запись грузится, null — раздел ему не отмечен.
type Chosen = { client: GuideMarkClient; existing: GuideMark | null | undefined };

/**
 * Лист «Про клиента» (#1484): из общего справочника — список клиентов с поиском (порядок и поиск — как
 * в «Все клиенты»), у кого раздел уже отмечен — пометка, тап открывает его запись; затем
 * необязательная строка «как это у клиента» (кризисная проверка, №7). Сохраняет и снимает вызывающий.
 */
export function GuideMarkSheet({ address, title, fragment, client, existing, onSave, onRemove, onClose }: Props) {
  const back = useRef<SheetBack | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(client ? { client, existing: existing ?? null } : null);
  const clients = useTherapyClientList(!!client);
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (client || fragment !== undefined) return;
    let alive = true;
    api.getGuideMarkClients(address).then((r) => { if (alive) setMarked(new Set(r.clientIds)); }, () => {});
    return () => { alive = false; };
  }, [address, client, fragment]);

  const choose = (c: TherapyClientSummary) => {
    const next: GuideMarkClient = { id: c.telegramId, name: clientDisplayName(c) };
    if (fragment === undefined && !marked.has(String(c.telegramId))) return setChosen({ client: next, existing: null });
    setChosen({ client: next, existing: undefined });
    api.getGuideMarks(c.telegramId).then(
      (r) => setChosen({ client: next, existing: findMark(r.marks, address, fragment) ?? null }),
      () => setChosen({ client: next, existing: null }),
    );
  };
  const close = (then: () => void) => { then(); back.current?.(); };
  const shown = clients ? sortRoster(clients.filter((c) => matchesRosterSearch(c, query)), todayStr()) : [];

  return (
    <ConceptFullscreenSheet title="Про клиента" label="Про клиента" column={680} closeLabel="Закрыть" onClose={onClose} backRef={back} panel>
      <div className="gd-page pa-page" data-no-guide-mark>
        <div className="pa-block">
          <h2 className="pp-hero-title">{title}</h2>
          {fragment !== undefined && <blockquote className="gd-sel-quote">{fragment}</blockquote>}
          <p className="ds-sub">{fragment !== undefined ? 'Выделенный текст' : 'Раздел справочника'} ляжет в карточку клиента, в блок «Из справочника» под схемой случая. Клиент его не видит.</p>
        </div>
        {!chosen && (
          <div className="pa-block">
            <input
              className="ds-input ds-input--search" value={query} placeholder="Найти клиента" aria-label="Найти клиента"
              onChange={(e) => setQuery(e.target.value)}
            />
            {clients === undefined && <SkeletonList rows={3} height={44} />}
            {clients === null && <span className="tb-error" role="alert">Список клиентов не загрузился</span>}
            {clients?.length === 0 && <span className="ds-sub">Клиентов пока нет.</span>}
            {shown.map((c) => (
              <button key={c.telegramId} type="button" className="ds-list-row ds-list-row--hover ds-list-row--nav" onClick={() => choose(c)}>
                <span className="ds-list-body">
                  <span className="ds-list-title">{clientDisplayName(c)}</span>
                  {marked.has(String(c.telegramId)) && <span className="ds-list-sub">уже отмечено</span>}
                </span>
                <span className="ds-chev" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        {chosen && chosen.existing === undefined && <Skeleton height={120} />}
        {chosen && chosen.existing !== undefined && (
          <MarkNoteForm
            key={String(chosen.client.id)} chosen={chosen}
            onSave={(note) => close(() => onSave(chosen.client, note))}
            onRemove={(mark) => close(() => onRemove(mark, chosen.client))}
          />
        )}
      </div>
    </ConceptFullscreenSheet>
  );
}

function MarkNoteForm({ chosen, onSave, onRemove }: {
  chosen: Chosen; onSave: (note: string) => void; onRemove: (mark: GuideMark) => void;
}) {
  const { client, existing } = chosen;
  const [note, setNote] = useState(existing?.note ?? '');
  return (
    <div className="pa-block">
      <span className="ds-label" aria-hidden>{client.name} · как это у клиента, необязательно</span>
      <LimitedTextarea
        max={GUIDE_MARK_NOTE_MAX} className="ds-textarea" rows={3} value={note}
        aria-label="Как это у клиента" onChange={(e) => setNote(e.target.value)}
      />
      {detectCrisisAny(note) && <CrisisCard surface="note" compact />}
      <div className="gd-acts">
        <button type="button" className="ds-btn" onClick={() => onSave(note)}>{existing ? 'Сохранить' : 'Отметить'}</button>
        {existing && (
          <button type="button" className="ds-btn ds-btn--secondary" onClick={() => onRemove(existing)}>Снять отметку</button>
        )}
      </div>
    </div>
  );
}
