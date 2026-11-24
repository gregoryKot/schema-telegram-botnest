import { useRef, useState } from 'react';
import { isCalendarDate } from '../../../../../../shared/src/utils/calendarDate';
import { todayStr } from '../../../../../../shared/src/utils/format';
import { pluralRu } from '../../../../../../shared/src/utils/pluralRu';
import { pathTemplateWeeks, type PathTemplate } from '../../../../../../shared/src/therapy/path/templates';
import { ConceptFullscreenSheet, type SheetBack } from '../../ConceptFullscreenSheet';

interface Props {
  templates: PathTemplate[];
  busy: boolean;
  error: string;
  /** null — пустой путь без фаз; true — путь собран, лист закрывается. */
  onCreate: (startDate: string, template: PathTemplate | null) => Promise<boolean>;
  onClose: () => void;
}

const EMPTY = '';

/** Лист «Собрать путь»: шаблон (или пустой путь) и день старта; собранный путь сразу встаёт лентой. */
export function PathCreateSheet({ templates, busy, error, onCreate, onClose }: Props) {
  const back = useRef<SheetBack | null>(null);
  const [picked, setPicked] = useState(templates[0]?.id ?? EMPTY);
  // день старта — местный день терапевта: он и вводит даты сам
  const [start, setStart] = useState(todayStr);
  const valid = isCalendarDate(start);
  const options = [
    ...templates.map((t) => ({
      id: t.id, name: t.name,
      sub: [t.summary, t.timing, `${t.phases.length} ${pluralRu(t.phases.length, 'фаза', 'фазы', 'фаз')} · ${pathTemplateWeeks(t)} нед.`],
    })),
    { id: EMPTY, name: 'Пустой путь', sub: ['Без фаз: каждую фазу добавляют вручную'] },
  ];
  const save = async () => {
    if (!valid || busy) return;
    const ok = await onCreate(start, templates.find((t) => t.id === picked) ?? null);
    if (ok) back.current?.();
  };

  return (
    <ConceptFullscreenSheet title="Собрать путь" label="Путь клиента" column={680} closeLabel="Закрыть" onClose={onClose} backRef={back} panel>
      <div className="ph-create">
        <div>
          <h2 className="pp-hero-title">Собрать путь</h2>
          <p className="ds-sub">Шаблон даёт фазы со сроками и критериями перехода из книг по схема-терапии. Названия, цели и сроки потом правятся. Клиент путь не видит.</p>
        </div>
        <fieldset className="ph-set ph-tpls">
          <legend className="ds-label">Шаблон</legend>
          {options.map((o) => (
            <label key={o.id || 'empty'} className={`ph-tpl${picked === o.id ? ' is-picked' : ''}`}>
              <input type="radio" name="path-template" checked={picked === o.id} onChange={() => setPicked(o.id)} />
              <span className="ph-tpl-text">
                <span className="ph-tpl-name">{o.name}</span>
                {o.sub.map((s) => <span key={s} className="ph-tpl-sub">{s}</span>)}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="ph-date">
          <span className="ds-label">Старт пути</span>
          <input type="date" className="ds-input" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        {error && <div className="tb-error" role="alert">{error}</div>}
        <div>
          <button type="button" className="ds-btn" disabled={!valid || busy} aria-busy={busy || undefined} onClick={() => void save()}>Собрать</button>
        </div>
      </div>
    </ConceptFullscreenSheet>
  );
}
