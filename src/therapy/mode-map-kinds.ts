// Типы карт кабинета терапевта («Графические карты», #963). Колонка
// ModeMap.kind — строка без миграции; неизвестное значение не отклоняется, а
// подменяется на 'problem' (DTO принимает любую строку, см. mode-maps.dto.ts).
// concept — карта, собранная из полей концептуализации; free — свободный холст.
// Контракт фронта — ModeMapKind в webapp/src/api.types.ts (сверка — спек).
export const MODE_MAP_KINDS = [
  'personality',
  'problem',
  'couple',
  'concept',
  'free',
] as const;

export type ModeMapKind = (typeof MODE_MAP_KINDS)[number];

export function normalizeModeMapKind(kind: string | undefined): ModeMapKind {
  return MODE_MAP_KINDS.includes(kind as ModeMapKind)
    ? (kind as ModeMapKind)
    : 'problem';
}
