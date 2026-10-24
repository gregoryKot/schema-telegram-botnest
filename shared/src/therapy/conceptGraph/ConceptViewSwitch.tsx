import { useState } from 'react';

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
  return (
    <div
      role="group"
      aria-label="Вид концептуализации"
      style={{
        display: 'inline-flex',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--r-14)',
        background: 'rgba(var(--fg-rgb),0.06)',
      }}
    >
      {OPTIONS.map((o) => {
        const active = view === o.view;
        return (
          <button
            key={o.view}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.view)}
            style={{
              minHeight: 44,
              minWidth: 72,
              padding: '0 16px',
              borderRadius: 'var(--r-10)',
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-sub)',
              fontSize: 13,
              fontWeight: active ? 700 : 500,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
