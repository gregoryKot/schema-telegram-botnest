// Pure data for the mode-map (no component imports): node/palette/edge files export only components.
import type { ModeMapNode } from '../api';

export type NodeType = ModeMapNode['type'];

// Цвет знака типа (палитра, легенда, выбор формы) — токен той же семьи, что бумага фигуры (modeMap/nodePaper.ts, TYPE_HUE); три копинга — один цвет, различает форма.
export const TYPE_COLORS: Record<string, string> = {
  trigger:  'var(--c-moss)',
  child:    'var(--c-clay)',
  critic:   'var(--c-plum)',
  coping:   'var(--c-slate)',
  healthy:  'var(--c-moss)',
  custom:   'var(--c-teal)',
  behavior: 'var(--c-ochre)',
  schema:   'var(--accent-red)', origin: 'var(--accent-blue)',  // схема случая на холсте (conceptToModeMap):
  need:     'var(--c-amber)',    needs:  'var(--c-amber)',      // схема, опыт, потребность, круг потребностей
};

export const NODE_DEFAULT_SIZES: Partial<Record<string, { width: number; height: number }>> = {};

export const DRAG_TYPE = 'application/modemap-node';

export const GROUP_TO_TYPE: Record<string, { type: NodeType; color: string; copingSubtype?: 'over' | 'avoid' | 'surr' }> = {
  child:                   { type: 'child',   color: TYPE_COLORS.child },
  coping_surrender:        { type: 'coping',  color: TYPE_COLORS.coping, copingSubtype: 'surr' },
  coping_avoidance:        { type: 'coping',  color: TYPE_COLORS.coping, copingSubtype: 'avoid' },
  coping_overcompensation: { type: 'coping',  color: TYPE_COLORS.coping, copingSubtype: 'over' },
  critic:                  { type: 'critic',  color: TYPE_COLORS.critic },
  healthy:                 { type: 'healthy', color: TYPE_COLORS.healthy },
};
