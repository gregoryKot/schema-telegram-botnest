import { TYPE_COLORS, type NodeType } from '../modeMapData';

// Формы/типы фигуры для панели редактора (из ModeMapNodeEditor.tsx, правило №10); заливка превью — токен или старый hex.
export const previewFill = (c: string) => c.startsWith('#') ? `${c}22` : `color-mix(in srgb, ${c} 14%, transparent)`;

export const BLOB_PATH = 'M12,2 C18,1 23,6 22,12 C23,18 18,23 11,22 C5,23 1,18 2,11 C1,5 6,3 12,2 Z'; // овал опыта, viewBox 24×24

export type CopingSubtype = 'over' | 'avoid' | 'surr';

export interface ShapeOption {
  type: NodeType;
  label: string;
  full?: string; // полное имя в подсказке, если подпись в клетке короче
  copingSubtype?: CopingSubtype;
  color: string;
  clip?: string;
  radius?: number | string;
  isCircle?: boolean;
  isCloud?: boolean;
}

// Подписи целыми словами: обрубки «Капит», «Избег», «Повед.» читались как опечатки (аудит холста 2026-11).
export const SHAPE_OPTIONS: ShapeOption[] = [
  { type: 'trigger',  label: 'Триггер', color: TYPE_COLORS.trigger, isCloud: true },
  { type: 'child',    label: 'Детский', full: 'Детский режим', color: TYPE_COLORS.child, isCircle: true },
  { type: 'critic',   label: 'Критик',  full: 'Критикующий режим', color: TYPE_COLORS.critic },
  { type: 'coping',   label: 'Гиперкомп.', full: 'Копинг: Гиперкомпенсация', color: TYPE_COLORS.coping, copingSubtype: 'over' },
  { type: 'coping',   label: 'Избегание', full: 'Копинг: Избегание', color: TYPE_COLORS.coping, copingSubtype: 'avoid' },
  { type: 'coping',   label: 'Капитуляция', full: 'Копинг: Капитуляция', color: TYPE_COLORS.coping, copingSubtype: 'surr' },
  { type: 'healthy',  label: 'Здоровый', full: 'Здоровый режим', color: TYPE_COLORS.healthy },
  { type: 'behavior', label: 'Поведение', color: TYPE_COLORS.behavior },
  { type: 'custom',   label: 'Свой',    full: 'Свой режим', color: TYPE_COLORS.custom },
  { type: 'schema',   label: 'Схема',   color: TYPE_COLORS.schema },    // фигуры схемы случая; круга потребностей
  { type: 'origin',   label: 'Опыт',    full: 'Опыт детства', color: TYPE_COLORS.origin }, // в выборе формы нет: он один на карту
  { type: 'need',     label: 'Потребность', color: TYPE_COLORS.need },
];
