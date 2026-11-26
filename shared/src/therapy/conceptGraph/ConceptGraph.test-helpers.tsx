// Общее для тестов схемы случая: хозяин состояния, как у фронтенда (колбэки
// графа меняют source, который он рисует), и запросы к DOM.
import { useState } from 'react';
import { screen } from '@testing-library/react';
import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';
import { AddressFormContext } from '../../utils/addressForm';
import { ConceptGraph } from './ConceptGraph';
import { conceptGraphHandlers } from './conceptGraphHandlers';
import type { ConceptGraphSource } from './conceptGraphTypes';
import { upsertModeLink } from './modeLinks';
import { upsertSchemaLink } from './schemaLinks';

export interface Spies {
  onToggleMode?: (id: string) => void;
  onChangeLink?: (l: ConceptModeLink) => void;
  onChangeSchemaLink?: (l: ConceptSchemaLink) => void;
  onAddSchema?: (id: string) => void;
  onToggleSchema?: (id: string) => void;
  track?: (name: string, meta?: Record<string, unknown>) => void;
}

export function Harness({
  initial,
  spies = {},
  form = 'ty',
}: {
  initial: Partial<ConceptGraphSource>;
  spies?: Spies;
  form?: 'ty' | 'vy';
}) {
  const [src, setSrc] = useState<ConceptGraphSource>({
    modeIds: [],
    schemaIds: [],
    modeLinks: [],
    schemaLinks: [],
    ...initial,
  });
  // Настоящие обработчики фронтендов поверх патча: тест идёт через тот же шов.
  const handlers = conceptGraphHandlers({
    modeIds: src.modeIds,
    modeLinks: src.modeLinks,
    schemaLinks: src.schemaLinks,
    schemaIds: src.schemaIds,
    patch: (p) => setSrc((s) => ({ ...s, ...p })),
  });
  return (
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      <ConceptGraph
        source={src}
        track={spies.track ?? (() => {})}
        onToggleMode={(id) => {
          spies.onToggleMode?.(id);
          setSrc((s) => ({
            ...s,
            modeIds: s.modeIds.includes(id)
              ? s.modeIds.filter((x) => x !== id)
              : [...s.modeIds, id],
          }));
        }}
        onChangeLink={(l) => {
          spies.onChangeLink?.(l);
          setSrc((s) => ({ ...s, modeLinks: upsertModeLink(s.modeLinks, l) }));
        }}
        onChangeSchemaLink={(l) => {
          spies.onChangeSchemaLink?.(l);
          setSrc((s) => ({
            ...s,
            schemaLinks: upsertSchemaLink(s.schemaLinks, l),
          }));
        }}
        onAddSchema={(id) => {
          spies.onAddSchema?.(id);
          handlers.onAddSchema(id);
        }}
        onToggleSchema={(id) => {
          spies.onToggleSchema?.(id);
          handlers.onToggleSchema(id);
        }}
      />
    </AddressFormContext.Provider>
  );
}

export const modeFigure = (name: string) =>
  screen.getByRole('button', { name: `${name}: связи` });
export const schemaFigure = (name: string) =>
  screen.getByRole('button', { name: `Схема ${name}: убеждение и опыт` });
export const needPill = (name: string) => screen.getByRole('button', { name });
export const edges = () =>
  Array.from(document.querySelectorAll<SVGPathElement>('path[data-edge]'));
export const badges = (kind: 'block' | 'meet') =>
  document.querySelectorAll(`[data-badge="${kind}"]`);
export const edgeOpacity = (el: Element) =>
  Number((el as SVGElement).style.opacity);
/** Заголовок секции целиком (role=group) — в нём своя кнопка добавления. */
export const sectionOf = (title: string) =>
  screen.getByRole('group', { name: title });
