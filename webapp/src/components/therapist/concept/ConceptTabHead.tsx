import { useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Dropdown } from '../../Dropdown';
import { useTr } from '../../../utils/addressForm';
import type { ClientDetail } from '../clientSheetTypes';
import { ConceptViewSwitch, type ConceptView } from '../../../../../shared/src/therapy/conceptGraph/ConceptViewSwitch';
import { SaveStatusLine } from '../../../../../shared/src/therapy/SaveStatusLine';
import { CANVAS_HINT, EXPAND_HINT, actionStatusText, type GraphActions } from './conceptHeadText';

// Шапка вкладки «Концептуализация» (#879, тест с терапевтом): в ней остаются
// только заголовок, статус сохранения и переключатель «Схема · Поля». Экспорт,
// картинка, лист на весь экран и холст — второстепенные действия, они собраны в
// одно меню «⋯ Ещё»: шапка из пяти кнопок читалась как панель инструментов, и
// терапевт не находил главного. Меню закрывается по выбору пункта, поэтому
// занятость и отказ действия показываются строкой под шапкой (ActionStatus),
// а не внутри меню.
export interface ConceptTabHeadProps {
  detail: ClientDetail;
  view: ConceptView;
  onView: (v: ConceptView) => void;
  /** Есть только в виде «Схема»; ClientConceptGraph добавляет сам. */
  graph?: GraphActions;
}

export function ConceptTabHead({ detail, view, onView, graph }: ConceptTabHeadProps) {
  const { saveStatus, savedAt, retrySave, exportCopied, handleExport } = detail;
  return (
    <>
      <div className="ds-head-row tcp-head">
        <div>
          <h2 className="ds-h2">Концептуализация</h2>
          <div className="ds-sub" style={{ marginTop: 4 }}>Схема-карта, цели терапии и связь с детским опытом</div>
        </div>
        <div className="tcp-head-actions">
          <SaveStatusLine className="tcp-save" status={saveStatus} savedAt={savedAt} onRetry={retrySave} align="right" />
          <ConceptViewSwitch view={view} onChange={onView} />
          <MoreMenu onExport={handleExport} graph={graph} />
        </div>
      </div>
      <ActionStatus graph={graph} exportCopied={exportCopied} />
    </>
  );
}

function MoreMenu({ onExport, graph }: { onExport: () => void; graph?: GraphActions }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={wrapRef} className="tcp-more">
      <button
        type="button"
        className="ds-btn ds-btn--secondary tcp-more-btn"
        aria-label="Ещё действия"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        ⋯ Ещё
      </button>
      {open && (
        <Dropdown anchorRef={wrapRef} onClose={() => setOpen(false)} role="menu" label="Ещё действия" className="tcp-menu">
          <MenuItem onClick={pick(onExport)}>↗ Экспорт текстом</MenuItem>
          {graph && (
            <>
              <MenuItem disabled={graph.image.busy} onClick={pick(graph.image.download)}>↓ Скачать картинкой</MenuItem>
              <MenuItem hint={EXPAND_HINT} onClick={pick(graph.expand)}>⤢ На весь экран</MenuItem>
              {graph.canvas && (
                <MenuItem hint={CANVAS_HINT} disabled={graph.canvas.busy} onClick={pick(graph.canvas.open)}>Открыть на холсте</MenuItem>
              )}
            </>
          )}
        </Dropdown>
      )}
    </div>
  );
}

// Пункт меню: название, под ним — подсказка строкой (видна без hover, в отличие
// от title). Имя пункта для ридера и тестов — только название (aria-labelledby),
// подсказка — его описание.
function MenuItem({ hint, children, ...rest }: { hint?: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const id = useId();
  return (
    <button type="button" role="menuitem" className="mm2-item" aria-labelledby={`${id}-l`} aria-describedby={hint ? `${id}-h` : undefined} {...rest}>
      <span id={`${id}-l`}>{children}</span>
      {hint && <span id={`${id}-h`} className="tcp-menu-hint">{hint}</span>}
    </button>
  );
}

function ActionStatus({ graph, exportCopied }: { graph?: GraphActions; exportCopied: boolean }) {
  const tr = useTr();
  const s = actionStatusText(graph, exportCopied, tr);
  if (!s) return null;
  return (
    <div role={s.err ? 'alert' : 'status'} className={`tcp-status${s.err ? ' is-err' : ''}`}>{s.text}</div>
  );
}
