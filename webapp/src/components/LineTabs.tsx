import { Fragment, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useStripEdges } from './history/dayStrip';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';
import { stepTab } from './lineTabsModel';
import '../styles/line-tabs.css';

export interface LineTab<T extends string> {
  id: T; label: ReactNode;
  /** Тихое число после подписи (записей в разделе); null — не загружено, числа нет. */
  count?: number | null;
  title?: string;
  /** Поле на месте пункта (переименование карты): рисуется вместо кнопки. */
  field?: ReactNode;
}

interface Props<T extends string> {
  tabs: readonly LineTab<T>[];
  value: T;
  onPick: (id: T) => void;
  label: string;
  /** scroll — лента с прокруткой (край с остальными затухает); fill — пункты по всей ширине; quiet — тихая пара «А · Б». */
  look: 'scroll' | 'fill' | 'quiet';
  /** Справа на той же линии: тихая пара вида. */
  aside?: ReactNode;
  /** id кнопки вкладки — для aria-labelledby панели. */
  tabId?: (id: T) => string;
  className?: string;
}

/**
 * Вкладки текстом на тонкой линии (line-tabs.css): у выбранной — акцентная черта снизу. Разделы «Справочника»,
 * вкладки листа и фильтры таблицы «Схем»; quiet — тихая пара справа на той же линии. Клавиатура — шаблон tablist.
 */
export function LineTabs<T extends string>({ tabs, value, onPick, label, look, aside, tabId, className }: Props<T>) {
  const { ref, edges, measure } = useStripEdges(0);
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const quiet = look === 'quiet';
  // Выбор ещё не пришёл (карта грузится) — в ленту по Tab ведёт первый пункт.
  const focusId = tabs.some((t) => t.id === value) ? value : tabs[0]?.id;
  useEffect(() => {
    if (look !== 'scroll') return;
    scrollIntoViewSafe(buttons.current.get(value), { block: 'nearest', inline: 'nearest' });
    measure();
  }, [look, value, tabs.length, measure]);

  const onKey = (e: KeyboardEvent) => {
    const next = stepTab(tabs.filter((t) => !t.field).map((t) => t.id), value, e.key);
    if (next == null) return;
    e.preventDefault();
    onPick(next);
    buttons.current.get(next)?.focus();
  };

  const strip = (
    <div
      ref={quiet ? undefined : ref} role="tablist" aria-label={label} onScroll={quiet ? undefined : measure}
      className={quiet ? `lt-quiet${className ? ` ${className}` : ''}` : `lt-strip lt-strip--${look}${look === 'scroll' ? ' ds-seg--fade' : ''}`}
      data-fade-start={!quiet && edges.start ? '' : undefined} data-fade-end={!quiet && edges.end ? '' : undefined}
    >
      {tabs.map((t, i) => (
        <Fragment key={t.id}>
          {quiet && i > 0 && <span className="lt-sep" aria-hidden="true">·</span>}
          {t.field ?? <button
            ref={(el) => { if (el) buttons.current.set(t.id, el); else buttons.current.delete(t.id); }}
            type="button" role="tab" id={tabId?.(t.id)} aria-selected={t.id === value} tabIndex={t.id === focusId ? 0 : -1}
            title={t.title} className={quiet ? 'lt-q' : 'lt-tab'} onClick={() => onPick(t.id)} onKeyDown={onKey}
          >
            {t.label}{t.count != null && <span className="ds-count lt-count">{t.count}</span>}
          </button>}
        </Fragment>
      ))}
    </div>
  );
  if (quiet) return strip;
  return (
    <div className={`lt${className ? ` ${className}` : ''}`}>
      {strip}
      {aside && <div className="lt-aside">{aside}</div>}
    </div>
  );
}
