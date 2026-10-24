import { TYPE_COLORS, type NodeType } from '../modeMapData';

// Палитра форм/типов ноды для панели редактора (вынесено из ModeMapNodeEditor.tsx, правило №10).
// Preview fill — token-aware (color-mix) with a legacy-hex fallback.
export const previewFill = (c: string) => c.startsWith('#') ? `${c}22` : `color-mix(in srgb, ${c} 14%, transparent)`;

export const BLOB_PATH = 'M12,2 C18,1 23,6 22,12 C23,18 18,23 11,22 C5,23 1,18 2,11 C1,5 6,3 12,2 Z'; // овал опыта, viewBox 24×24

export type CopingSubtype = 'over' | 'avoid' | 'surr';

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
  { type: 'schema',   label: 'Схема',   color: TYPE_COLORS.schema },    // схема случая; круг потребностей
  { type: 'origin',   label: 'Опыт',    color: TYPE_COLORS.origin },    // в выбор формы не входит — он один на карту
  { type: 'need',     label: 'Потребн.', color: TYPE_COLORS.need },
];

