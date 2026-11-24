import { Fragment, useState } from 'react';
import { useConceptSkin } from './conceptSkin';

export type ConceptView = 'graph' | 'fields';

/** Схема, если на карте уже есть режимы, иначе поля: пустую схему не открывают. */
export function defaultConceptView(modeCount: number): ConceptView {
  return modeCount > 0 ? 'graph' : 'fields';
}

/**
 * Вид выбирается один раз при открытии: если считать его на каждом рендере,
 * первый же добавленный в «Полях» режим перебросил бы терапевта на схему
 * посреди выбора.
 */
export function useConceptView(
  modeCount: number,
): [ConceptView, (v: ConceptView) => void] {
  return useState<ConceptView>(() => defaultConceptView(modeCount));
}

const OPTIONS: { view: ConceptView; label: string }[] = [
  { view: 'graph', label: 'Схема' },
  { view: 'fields', label: 'Поля' },
];

/** Переключатель «Схема · Поля» над концептуализацией; вид — классы skin.tabs (сайт: тихая пара LineTabs). */
export function ConceptViewSwitch({
  view,
  onChange,
}: {
  view: ConceptView;
  onChange: (v: ConceptView) => void;
}) {
  const skin = useConceptSkin();
  return (
    <div
      role="group"
      aria-label="Вид концептуализации"
      className={skin?.tabs.group}
    >
      {OPTIONS.map((o, i) => (
        <Fragment key={o.view}>
          {i > 0 && <span className={skin?.tabs.sep} aria-hidden="true">·</span>}
          <button
            type="button"
            aria-pressed={view === o.view}
            onClick={() => onChange(o.view)}
            className={skin?.tabs.btn}
          >
            {o.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
