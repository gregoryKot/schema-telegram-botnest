// Pure data for the mode-map (no component imports) — split out of the node/
// palette/edge components so those files export only components (react-refresh).
import type { ModeMapNode } from '../api';

export type NodeType = ModeMapNode['type'];

// Node colours from the site's earthy palette tokens (index.css --c-*): coping
// subtypes share ONE colour (clay) and are told apart by SHAPE, not hue.
export const TYPE_COLORS: Record<string, string> = {
  trigger:  'var(--c-slate)',
  child:    'var(--c-teal)',
  critic:   'var(--c-rose)',
  coping:   'var(--c-clay)',
  healthy:  'var(--c-moss)',
  custom:   'var(--c-plum)',
  behavior: 'var(--c-ochre)',
};

export const NODE_DEFAULT_SIZES: Partial<Record<string, { width: number; height: number }>> = {};

export const DRAG_TYPE = 'application/modemap-node';

export const GROUP_TO_TYPE: Record<string, { type: NodeType; color: string; copingSubtype?: 'over' | 'avoid' | 'surr' }> = {
  child:                   { type: 'child',   color: 'var(--c-teal)' },
  coping_surrender:        { type: 'coping',  color: 'var(--c-clay)', copingSubtype: 'surr' },
  coping_avoidance:        { type: 'coping',  color: 'var(--c-clay)', copingSubtype: 'avoid' },
  coping_overcompensation: { type: 'coping',  color: 'var(--c-clay)', copingSubtype: 'over' },
  critic:                  { type: 'critic',  color: 'var(--c-rose)' },
  healthy:                 { type: 'healthy', color: 'var(--c-moss)' },
};
