import type { ModeMapNode } from '../../api';
import { TYPE_COLORS } from '../modeMapData';

// Палитра форм/типов ноды и её превью для панели редактора.
// Вынесено из ModeMapNodeEditor.tsx (правило №10).

// Preview fill — token-aware (color-mix) with a legacy-hex fallback.
export const previewFill = (c: string) => c.startsWith('#') ? `${c}22` : `color-mix(in srgb, ${c} 14%, transparent)`;

export type CopingSubtype = 'over' | 'avoid' | 'surr';

type NodeType = ModeMapNode['type'];

export interface ShapeOption {
  type: NodeType;
  label: string;
  copingSubtype?: CopingSubtype;
  color: string;
  clip?: string;
  radius?: number | string;
  isCircle?: boolean;
  isCloud?: boolean;
}

export const SHAPE_OPTIONS: ShapeOption[] = [
  { type: 'trigger',  label: 'Триггер', color: TYPE_COLORS.trigger, isCloud: true },
  { type: 'child',    label: 'Детский', color: TYPE_COLORS.child,   isCircle: true },
  { type: 'critic',   label: 'Критик',  color: TYPE_COLORS.critic },
  { type: 'coping',   label: 'Гипер',   color: TYPE_COLORS.coping, copingSubtype: 'over' },
  { type: 'coping',   label: 'Избег',   color: TYPE_COLORS.coping, copingSubtype: 'avoid' },
  { type: 'coping',   label: 'Капит',   color: TYPE_COLORS.coping, copingSubtype: 'surr' },
  { type: 'healthy',  label: 'Здоров',  color: TYPE_COLORS.healthy },
  { type: 'behavior', label: 'Повед.',  color: TYPE_COLORS.behavior },
  { type: 'custom',   label: 'Свой',    color: TYPE_COLORS.custom },
];

