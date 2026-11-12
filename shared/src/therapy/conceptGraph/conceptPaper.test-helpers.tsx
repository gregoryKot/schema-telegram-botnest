import type { ReactNode } from 'react';
import { ConceptPaperContext, type ConceptPaper } from './conceptPaper';

/** Детали «живой бумаги» для тестов shared: знак, чип и группа — простыми элементами с data-атрибутами. */
export const TEST_PAPER: ConceptPaper = {
  sign: (sign, size) => <i data-sign={sign} data-size={size} />,
  Chip: ({ label, on, onToggle, sign, hue }) => (
    <button
      type="button"
      aria-pressed={on}
      data-chip-sign={sign}
      data-hue={hue}
      onClick={onToggle}
    >
      {label}
    </button>
  ),
  Group: ({ look, title, children }) => (
    <section data-group-hue={look.hue} data-group-sign={look.sign}>
      <h3>{title}</h3>
      {children}
    </section>
  ),
  emptyScene: <i data-scene="" />,
};

export const withPaper = (ui: ReactNode) => (
  <ConceptPaperContext.Provider value={TEST_PAPER}>
    {ui}
  </ConceptPaperContext.Provider>
);
