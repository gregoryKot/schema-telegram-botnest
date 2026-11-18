import { useEffect, useRef, useState } from 'react';
import { api, reportClientError, type TherapyClientSummary, type UserId } from '../../../api';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { PLAN_ITEM_TEXT_MAX } from '../../../../../shared/src/limits/textLimits';
import { joinSentences } from '../../../../../shared/src/schemaTherapy/guide/sentences';
import { trackPlanItemAdded } from '../../../../../shared/src/share/planAnalytics';
import { clientDisplayName } from '../../../../../shared/src/therapy/clientInitials';
import { PLAN_RUBRIC_LABEL } from '../../../../../shared/src/therapy/plan/planItem';
import { Skeleton } from '../../Skeleton';
import { ConceptFullscreenSheet, type SheetBack } from '../ConceptFullscreenSheet';
import type { PlanDraft } from '../guide/guidePlan';
import { cleanText } from './planModel';

/** Сервер принимает за раз не больше стольких клиентов. */
const CLIENTS_MAX = 50;

interface Props {
  draft: PlanDraft;
  /** Справочник открыт из карточки — клиент известен, список не показывается. */
  clientId?: UserId;
  onAdded?: () => void;
  onClose: () => void;
}

/**
 * Лист «В план» (#1337): текст рубрики справочника по частям (сняли галочку — часть ушла из текста), текст
 * правится, отмеченное уходит в план одним пунктом. Из общего справочника — выбор клиентов, можно нескольких.
 * Ложится поверх листа статьи: та же панель, позже в DOM.
 */
export function PlanAddSheet({ draft, clientId, onAdded, onClose }: Props) {
  const back = useRef<SheetBack | null>(null);
  const [checked, setChecked] = useState(() => draft.parts.map(() => true));
  const [text, setText] = useState(() => joinSentences(draft.parts));
  // undefined — список грузится, null — не пришёл
  const [clients, setClients] = useState<TherapyClientSummary[] | null | undefined>(undefined);
  const [picked, setPicked] = useState<string[]>(clientId != null ? [String(clientId)] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (clientId != null) return;
    api.getTherapyClients().then(
      (list) => { if (alive.current) setClients(list); },
      () => { if (alive.current) setClients(null); },
    );
  }, [clientId]);

  const togglePart = (i: number) => {
    const next = checked.map((c, j) => (j === i ? !c : c));
    setChecked(next);
    setText(joinSentences(draft.parts.filter((_, j) => next[j])));
  };
  const toggleClient = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const clean = cleanText(text);
  const save = async () => {
    if (!clean || picked.length === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.createPlanItems({ clientIds: picked, rubric: draft.rubric, text: clean, source: draft.source });
      trackPlanItemAdded(api, draft.rubric, true);
      onAdded?.();
      if (alive.current) setDone(true);
    } catch {
      reportClientError({ message: 'therapy plan add from guide failed', section: 'therapist.plan' });
      if (alive.current) setError('Не удалось добавить в план');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <ConceptFullscreenSheet title={`В план: ${draft.label}`} label="В план" column={680} closeLabel="Закрыть" onClose={onClose} backRef={back} panel>
      <div className="gd-page pa-page">
        {done ? (
          <div className="pa-block" role="status">
            <h2 className="pp-hero-title">Добавлено в план</h2>
            <p className="ds-sub">Пункт стоит во вкладке «План работы» карточки клиента, в рубрике «{PLAN_RUBRIC_LABEL[draft.rubric]}».</p>
            <div><button type="button" className="ds-btn" onClick={() => back.current?.()}>Готово</button></div>
          </div>
        ) : (
          <>
            <div className="pa-block">
              <h2 className="pp-hero-title">{draft.label}</h2>
              <p className="ds-sub">Пункт попадёт во вкладку «План работы» карточки клиента, в рубрику «{PLAN_RUBRIC_LABEL[draft.rubric]}». Клиент план не видит.</p>
            </div>
            {draft.parts.length > 1 && (
              <fieldset className="pa-block pa-set">
                <legend className="ds-label">Что взять</legend>
                {draft.parts.map((part, i) => (
                  <label key={i} className="pa-check">
                    <input type="checkbox" checked={checked[i]} onChange={() => togglePart(i)} />
                    <span>{part}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <div className="pa-block">
              <span className="ds-label" aria-hidden>Текст пункта</span>
              <LimitedTextarea
                max={PLAN_ITEM_TEXT_MAX} className="ds-textarea" rows={5} value={text}
                aria-label="Текст пункта" onChange={(e) => setText(e.target.value)}
              />
            </div>
            {clientId == null && (
              <fieldset className="pa-block pa-set">
                <legend className="ds-label">Кому в план</legend>
                {clients === undefined && <Skeleton height={44} />}
                {clients === null && <span className="tb-error" role="alert">Список клиентов не загрузился</span>}
                {clients?.length === 0 && <span className="ds-sub">Клиентов пока нет — план ведётся в карточке клиента.</span>}
                {clients?.map((c) => {
                  const id = String(c.telegramId);
                  const on = picked.includes(id);
                  return (
                    <label key={id} className="pa-check">
                      <input type="checkbox" checked={on} disabled={!on && picked.length >= CLIENTS_MAX} onChange={() => toggleClient(id)} />
                      <span>{clientDisplayName(c)}</span>
                    </label>
                  );
                })}
              </fieldset>
            )}
            {error && <div className="tb-error" role="alert">{error}</div>}
            <div>
              <button
                type="button" className="ds-btn" disabled={!clean || picked.length === 0 || busy}
                aria-busy={busy || undefined} onClick={() => void save()}
              >
                Добавить в план
              </button>
            </div>
          </>
        )}
      </div>
    </ConceptFullscreenSheet>
  );
}
