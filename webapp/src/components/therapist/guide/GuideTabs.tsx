import { useContext, type KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { scrollIntoViewSafe } from '../../../../../shared/src/utils/scrollIntoView';
import { GuideMarkContext } from './marks/GuideSectionMark';
import { GUIDE_TAB_LABEL, guideTabs, markedTabs, type GuideTabId, type TabbedKind } from './guideTabsModel';

export interface GuideTabsProps {
  kind: TabbedKind; articleId: string;
  /** Содержимое вкладок; вкладка, чьи разделы все пустые, не показывается. Какой раздел где — guideTabsModel. */
  panels: Partial<Record<GuideTabId, ReactNode>>;
}

/** Панель без единого раздела (все GuideSection пустые) — вкладки нет. */
const isEmpty = (el: HTMLElement | undefined) => !!el && el.childElementCount === 0;

/**
 * Вкладки листа справочника: липкий ds-seg под героем, содержимое меняется на месте — лист не прыгает к якорю.
 * Скрытые панели остаются в DOM под hidden="until-found": поиск браузера находит текст и сам открывает его вкладку;
 * адреса разделов и «Про клиента» живут как без вкладок. Точка на вкладке — там есть отметки клиента.
 */
export function GuideTabs({ kind, articleId, panels }: GuideTabsProps) {
  const order = guideTabs(kind).filter((id) => panels[id] != null && panels[id] !== false);
  const [active, setActive] = useState<GuideTabId>(order[0]);
  const [empty, setEmpty] = useState<string>('');
  const refs = useRef<Partial<Record<GuideTabId, HTMLDivElement>>>({});
  const wrap = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const shown = order.filter((id) => !empty.split(' ').includes(id));
  const current = shown.includes(active) ? active : shown[0];
  const uid = useId(); // листов с вкладками бывает два сразу (режим под техникой)
  const ctx = useContext(GuideMarkContext);
  const dots = markedTabs(kind, articleId, ctx?.client?.marked.keys() ?? []);

  // Пустоту видно только после отрисовки: GuideSection сам решает, рисоваться ли.
  useLayoutEffect(() => {
    const next = order.filter((id) => isEmpty(refs.current[id])).join(' ');
    if (next !== empty) setEmpty(next);
  });

  useEffect(() => {
    const cleanups = order.map((id) => {
      const el = refs.current[id];
      if (!el) return () => {};
      // hidden="until-found" — руками: типы React знают у hidden только boolean.
      if (id === current) el.removeAttribute('hidden'); else el.setAttribute('hidden', 'until-found');
      const onMatch = () => setActive(id);
      el.addEventListener('beforematch', onMatch);
      return () => el.removeEventListener('beforematch', onMatch);
    });
    return () => cleanups.forEach((c) => c());
  });

  const pick = (id: GuideTabId) => {
    setActive(id);
    // Полоса уже прилипла — новая вкладка встаёт под неё с начала; лист выше полосы не двигается.
    const stuck = bar.current && bar.current.getBoundingClientRect().top <= (bar.current.parentElement?.closest('.cfs-body')?.getBoundingClientRect().top ?? 0) + 1;
    if (stuck) requestAnimationFrame(() => scrollIntoViewSafe(wrap.current, { block: 'start' }));
  };
  // Стрелки ←/→ ходят по вкладкам по кругу (шаблон tablist), фокус — за выбором.
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const next = shown[(shown.indexOf(current) + step + shown.length) % shown.length];
    pick(next);
    document.getElementById(`${uid}${next}`)?.focus();
  };

  return (
    <>
      {shown.length > 1 && (
        <div ref={bar} className="gd-tabs">
          <div role="tablist" aria-label="Разделы листа" className="ds-seg ds-seg--full">
            {shown.map((id) => (
              <button
                key={id} type="button" role="tab" aria-selected={id === current} tabIndex={id === current ? 0 : -1} id={`${uid}${id}`}
                className={`ds-seg-btn${id === current ? ' is-active' : ''}`} onClick={() => pick(id)} onKeyDown={onKey}
              >
                {GUIDE_TAB_LABEL[id]}
                {dots.has(id) && <span className="gd-tab-dot" title="Есть отметки про клиента" />}
              </button>
            ))}
          </div>
        </div>
      )}
      <div ref={wrap} className="gd-panels">
        {order.map((id) => (
          <div
            key={id} ref={(el) => { refs.current[id] = el ?? undefined; }} data-tab={id} className="gd-panel"
            role={shown.length > 1 ? 'tabpanel' : undefined} aria-labelledby={shown.length > 1 ? `${uid}${id}` : undefined}
          >
            {panels[id]}
          </div>
        ))}
      </div>
    </>
  );
}
