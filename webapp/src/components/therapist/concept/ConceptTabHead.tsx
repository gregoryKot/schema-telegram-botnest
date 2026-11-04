import { useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Dropdown } from '../../Dropdown';
import { useMenuPick } from '../../useMenuPick';
import { useTr } from '../../../utils/addressForm';
import type { ClientDetail } from '../clientSheetTypes';
import { TabTitle } from '../TabTitle';
import { ConceptViewSwitch, type ConceptView } from '../../../../../shared/src/therapy/conceptGraph/ConceptViewSwitch';
import { SaveStatusLine } from '../../../../../shared/src/therapy/SaveStatusLine';
import { CANVAS_HINT, EXPAND_HINT, actionStatusText, type GraphActions } from './conceptHeadText';
import { CONCEPT_EXPORT_EMPTY } from '../../../../../shared/src/therapy/conceptExport';

// Шапка вкладки «Концептуализация» (#879, тест с терапевтом): в ней остаются
// только переключатель «Схема · Поля» и статус сохранения. Экспорт, картинка,
// лист на весь экран и холст — второстепенные действия, они собраны в одно
// меню «⋯»: шапка из пяти кнопок читалась как панель инструментов, и терапевт
// не находил главного. Меню закрывается по выбору пункта, поэтому занятость и
// отказ действия показываются строкой под шапкой (ActionStatus), а не внутри
// меню. Заголовок, подпись и слово «Ещё» — на ≥768; на телефоне (#906) их прячет CSS.
export interface ConceptTabHeadProps {
  detail: ClientDetail;
  view: ConceptView;
  onView: (v: ConceptView) => void;
  /** Есть только в виде «Схема»; ClientConceptGraph добавляет сам. */
  graph?: GraphActions;
}

export function ConceptTabHead({ detail, view, onView, graph }: ConceptTabHeadProps) {
  const { saveStatus, savedAt, retrySave, conceptError, exportCopied, exportEmpty, handleExport } = detail;
  return (
    <>
      <div className="tcp-head">
        <TabTitle title="Концептуализация" className="tcp-head-title"><div className="ds-sub">Схема-карта, цели терапии и связь с детским опытом</div></TabTitle>
        <SaveStatusLine className="tcp-save" status={saveStatus} savedAt={savedAt} onRetry={retrySave} errorText={conceptError || undefined} align="right" />
        <ConceptViewSwitch view={view} onChange={onView} />
        <MoreMenu onExport={handleExport} exportEmpty={exportEmpty} graph={graph} />
      </div>
      <ActionStatus graph={graph} exportCopied={exportCopied} />
    </>
  );
}

function MoreMenu({ onExport, exportEmpty, graph }: { onExport: () => void; exportEmpty: boolean; graph?: GraphActions }) {
  const { open, setOpen, btnRef, pick } = useMenuPick();
  const wrapRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={wrapRef} className="tcp-more">
      <button
        ref={btnRef} type="button"
        className="ds-btn ds-btn--icon"
        aria-label="Ещё действия"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        ⋯<span className="tcp-more-txt"> Ещё</span>
      </button>
      {open && (
        <Dropdown anchorRef={wrapRef} onClose={() => setOpen(false)} role="menu" label="Ещё действия" className="tcp-menu">
          <MenuItem disabled={exportEmpty} hint={exportEmpty ? CONCEPT_EXPORT_EMPTY : undefined} onClick={pick(onExport)}>↗ Экспорт текстом</MenuItem>
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
    <button type="button" role="menuitem" className="ds-menu-item" aria-labelledby={`${id}-l`} aria-describedby={hint ? `${id}-h` : undefined} {...rest}>
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
