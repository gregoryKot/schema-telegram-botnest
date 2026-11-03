import { useState } from 'react';
import { SEG_GROUP, segBtn } from './conceptInlineStyles';
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

/** Переключатель «Схема · Поля» над концептуализацией (оба фронтенда). */
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
      className={skin?.seg.group}
      style={skin ? undefined : SEG_GROUP}
    >
      {OPTIONS.map((o) => {
        const active = view === o.view;
        return (
          <button
            key={o.view}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.view)}
            className={
              skin ? skin.seg.btn + (active ? ' is-active' : '') : undefined
            }
            style={skin ? undefined : segBtn(active)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
