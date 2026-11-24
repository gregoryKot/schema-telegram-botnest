import { useRef, useState } from 'react';
import type { UserId } from '../../../api';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { PLAN_ITEM_TEXT_MAX } from '../../../../../shared/src/limits/textLimits';
import { joinSentences } from '../../../../../shared/src/schemaTherapy/guide/sentences';
import { PLAN_RUBRICS, PLAN_RUBRIC_LABEL } from '../../../../../shared/src/therapy/plan/planItem';
import { ConceptFullscreenSheet, type SheetBack } from '../ConceptFullscreenSheet';
import { PlanClientPicker } from './PlanClientPicker';
import type { PlanDraft } from '../guide/guidePlan';
import { cleanText } from './planModel';
import { usePhasePick } from './path/usePhasePick';
import { usePlanAdd } from './usePlanAdd';
import { usePlanTwins } from './usePlanTwins';

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
 * Рубрику, подобранную по тексту (`pickRubric`), можно сменить; у кого такой пункт уже стоит — второй раз не
 * добавляется; «Отменить» на итоге убирает добавленное.
 * Ложится поверх листа статьи: та же панель, позже в DOM.
 */
export function PlanAddSheet({ draft, clientId, onAdded, onClose }: Props) {
  const back = useRef<SheetBack | null>(null);
  const [checked, setChecked] = useState(() => draft.parts.map(() => true));
  // сервер длиннее предела не примет — собранный текст режется до него
  const compose = (parts: string[]) => joinSentences(parts).slice(0, PLAN_ITEM_TEXT_MAX);
  const [text, setText] = useState(() => compose(draft.parts));
  const [picked, setPicked] = useState<string[]>(clientId != null ? [String(clientId)] : []);
  const pick = usePhasePick(picked.length === 1 ? picked[0] : null, draft.sourceAddress);
  const [rubric, setRubric] = useState(draft.rubric);
  const [added, setAdded] = useState<number[] | null>(null); // id добавленных пунктов; null — ещё не добавляли
  const twins = usePlanTwins(picked, draft.sourceAddress);

  const togglePart = (i: number) => {
    const next = checked.map((c, j) => (j === i ? !c : c));
    setChecked(next);
    setText(compose(draft.parts.filter((_, j) => next[j])));
  };
  const toggleClient = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const clean = cleanText(text);
  const fresh = clean ? picked.filter((id) => !twins.has(id, clean)) : [];
  const skipped = picked.length - fresh.length;
  const { busy, error, save, undo } = usePlanAdd({ added, setAdded, onAdded });
  const add = () => { if (clean) void save({ clientIds: fresh, rubric, text: clean, sourceAddress: draft.sourceAddress, ...(pick.phaseId != null && { phaseId: pick.phaseId }) }); };

  return (
    <ConceptFullscreenSheet title={`В план: ${draft.label}`} label="В план" column={680} closeLabel="Закрыть" onClose={onClose} backRef={back} panel>
      <div className="gd-page pa-page">
        {added ? (
          <div className="pa-block" role="status">
            <h2 className="pp-hero-title">Добавлено в план</h2>
            <p className="ds-sub">Пункт стоит во вкладке «План работы» карточки клиента, в рубрике «{PLAN_RUBRIC_LABEL[rubric]}».</p>
            {error && <div className="tb-error" role="alert">{error}</div>}
            <div className="gd-acts">
              <button type="button" className="ds-btn" onClick={() => back.current?.()}>Готово</button>
              {added.length > 0 && <button type="button" className="ds-btn ds-btn--secondary" disabled={busy} aria-busy={busy || undefined} onClick={() => void undo()}>Отменить</button>}
            </div>
          </div>
        ) : (
          <>
            <div className="pa-block">
              <h2 className="pp-hero-title">{draft.label}</h2>
              <p className="ds-sub">Пункт попадёт во вкладку «План работы» карточки клиента, в рубрику «{PLAN_RUBRIC_LABEL[rubric]}». Клиент план не видит.</p>
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
            {draft.pickRubric && (
              <label className="pa-block">
                <span className="ds-label">Рубрика плана</span>
                <select className="ds-input" value={rubric} onChange={(e) => setRubric(e.target.value as typeof rubric)}>
                  {PLAN_RUBRICS.map((r) => <option key={r} value={r}>{PLAN_RUBRIC_LABEL[r]}</option>)}
                </select>
              </label>
            )}
            {clientId == null && (
              <PlanClientPicker picked={picked} onToggle={toggleClient} />
            )}
            {pick.phases.length > 0 && (
              <label className="pa-block">
                <span className="ds-label">Фаза пути</span>
                <select className="ds-input" value={pick.phaseId ?? ''} onChange={(e) => pick.setPhaseId(e.target.value ? Number(e.target.value) : null)}>
                  {pick.phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  <option value="">Без фазы</option>
                </select>
              </label>
            )}
            {skipped > 0 && (
              <p className="ds-sub" role="status">
                {clientId != null || picked.length === 1
                  ? 'Такой пункт уже стоит в плане — второй раз не добавится. Изменённый текст добавится отдельным пунктом.'
                  : `Такой пункт уже стоит в плане у ${skipped} из ${picked.length} — им второй раз не добавится.`}
              </p>
            )}
            {error && <div className="tb-error" role="alert">{error}</div>}
            <div>
              <button
                type="button" className="ds-btn" disabled={!clean || fresh.length === 0 || busy}
                aria-busy={busy || undefined} onClick={add}
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
