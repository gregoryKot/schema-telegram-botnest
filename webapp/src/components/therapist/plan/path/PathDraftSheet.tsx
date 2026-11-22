import { useEffect, useMemo, useRef, useState } from 'react';
import '../../../../styles/therapist-guide.css';
import { api, reportClientError, type UserId } from '../../../../api';
import { useGuide } from '../../../../../../shared/src/therapy/conceptGraph/guideLoader';
import { useTr } from '../../../../utils/addressForm';
import { Skeleton } from '../../../Skeleton';
import { ConceptFullscreenSheet, type SheetBack } from '../../ConceptFullscreenSheet';
import { draftEmpty, pathDraftView, type DraftRow, type DraftSource } from './pathDraftView';

interface Props extends DraftSource {
  clientId: UserId;
  /** Лист статьи справочника — поверх этого листа. */
  onOpen: (open: DraftRow['open']) => void;
  onOpenConcept: () => void;
  /** Пункты созданы — план перечитывается. */
  onAdded: () => void;
  onClose: () => void;
}

/**
 * Лист «Предложить по концептуализации» (#1522): что обычно делают в каждой фазе с режимами и схемами клиента.
 * Ничего не отмечено заранее: в план уходит только выбранное терапевтом, пунктами с фазой и адресом источника.
 */
export function PathDraftSheet({ clientId, onOpen, onOpenConcept, onAdded, onClose, ...src }: Props) {
  const tr = useTr();
  const guide = useGuide();
  const back = useRef<SheetBack | null>(null);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const { path, template, modeIds, schemaIds, items } = src;
  const groups = useMemo(
    () => (guide ? pathDraftView(guide, tr, { path, template, modeIds, schemaIds, items }) : []),
    [guide, tr, path, template, modeIds, schemaIds, items],
  );
  const rows = groups.flatMap((g) => g.rows);
  const chosen = rows.filter((r) => picked.includes(r.address));
  const toggle = (address: string) => setPicked((p) => (p.includes(address) ? p.filter((a) => a !== address) : [...p, address]));

  const save = async () => {
    if (chosen.length === 0 || busy) return;
    setBusy(true);
    setError('');
    let ok = 0;
    try {
      // по одному: ручка плана создаёт один пункт; сбой посередине оставляет созданное в плане
      for (const row of chosen) {
        await api.createPlanItems({ clientIds: [String(clientId)], rubric: 'session', text: row.title, sourceAddress: row.address, phaseId: row.phaseId });
        ok += 1;
      }
    } catch {
      reportClientError({ message: 'therapy path draft add failed', section: 'therapist.plan' });
      if (alive.current) setError(tr(`Добавлено ${ok} из ${chosen.length}. Остальное осталось в списке — попробуй ещё раз.`, `Добавлено ${ok} из ${chosen.length}. Остальное осталось в списке — попробуйте ещё раз.`));
    } finally {
      if (ok > 0) onAdded();
      if (alive.current) {
        setAdded((n) => n + ok);
        setBusy(false);
      }
    }
  };

  const empty = guide ? draftEmpty(groups, src) : null;
  let body;
  if (guide === undefined) body = <div className="pa-block" aria-hidden><Skeleton width="55%" height={16} /><Skeleton width="80%" height={44} /><Skeleton width="72%" height={44} /></div>;
  else if (guide === null) body = <div className="tb-error" role="alert">Справочник не загрузился. {tr('Закрой лист и открой снова.', 'Закройте лист и откройте снова.')}</div>;
  else if (empty === 'no-concept') {
    body = (
      <div className="pa-block">
        <p className="ds-sub">В концептуализации клиента пока нет ни режимов, ни схем — предлагать не из чего. {tr('Отметь их там, и здесь появится, что обычно делают в каждой фазе.', 'Отметьте их там, и здесь появится, что обычно делают в каждой фазе.')}</p>
        <div><button type="button" className="ds-btn" onClick={() => back.current?.(onOpenConcept)}>Открыть концептуализацию</button></div>
      </div>
    );
  } else if (empty === 'no-template') body = <p className="ds-sub">Предложения привязаны к фазам шаблона пути, а открытых фаз из шаблона в этом пути нет. Пункты в свои фазы добавляются кнопкой «В план» на листах справочника.</p>;
  else if (empty === 'nothing') body = <p className="ds-sub" role="status">{added > 0 ? `Добавлено в план: ${added}. ` : ''}Всё, что обычно делают с режимами и схемами этого клиента, уже стоит в плане.</p>;
  else {
    body = (
      <>
        {groups.map((g) => (
          <fieldset key={g.phaseId} className="pa-block pa-set">
            <legend className="ds-label">{g.phaseName}</legend>
            {g.rows.map((r) => (
              <div key={r.address} className="pd-row">
                <label className="pa-check">
                  <input type="checkbox" checked={picked.includes(r.address)} onChange={() => toggle(r.address)} />
                  <span className="pd-text">
                    <span>{r.title}</span>
                    <span className="pd-why">{r.why}{r.typical ? ' · обычно в этой фазе' : ''}</span>
                  </span>
                </label>
                <button type="button" className="ds-link pd-open" aria-label={`${r.title} — открыть в справочнике`} onClick={() => onOpen(r.open)}>Открыть</button>
              </div>
            ))}
          </fieldset>
        ))}
        {added > 0 && <div className="ds-sub" role="status">Добавлено в план: {added}.</div>}
        {error && <div className="tb-error" role="alert">{error}</div>}
        <div className="pd-bar">
          <button type="button" className="ds-btn" disabled={chosen.length === 0 || busy} aria-busy={busy || undefined} onClick={() => void save()}>
            Добавить выбранное ({chosen.length})
          </button>
        </div>
      </>
    );
  }

  return (
    <ConceptFullscreenSheet title="Предложить по концептуализации" label="Черновик пути" column={680} closeLabel="Закрыть" onClose={onClose} backRef={back} panel>
      <div className="gd-page pa-page pd-page">
        <div className="pa-block">
          <h2 className="pp-hero-title">Что обычно делают в каждой фазе</h2>
          <p className="ds-sub">Собрано из концептуализации клиента: по его режимам и схемам справочник подсказывает техники, а порядок работы с режимами — фазу. В план попадёт только отмеченное; клиент план не видит.</p>
        </div>
        {body}
      </div>
    </ConceptFullscreenSheet>
  );
}
