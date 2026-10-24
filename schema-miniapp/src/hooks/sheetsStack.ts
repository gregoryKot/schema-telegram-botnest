import { OVERLAY_SHEET_KEYS } from './anyOverlayOpen';
import type { SheetKey, SheetsValues } from './useSheets';

export type OverlaySheetKey = (typeof OVERLAY_SHEET_KEYS)[number];

// Порядок открытия листов: последний открытый — верхний, его и закрывает
// «Назад» хоста. Порядок ведёт редьюсер useSheets, чистые хелперы — здесь.

/** Ключ уходит наверх стека (повторное открытие переносит, а не дублирует). */
export const pushOpen = (order: readonly SheetKey[], key: SheetKey) => [
  ...order.filter((k) => k !== key),
  key,
];

/** Ключ убран из стека (закрытие закрытого — no-op). */
export const dropOpen = (order: readonly SheetKey[], key: SheetKey) =>
  order.filter((k) => k !== key);

// Экраны согласия (zIndex 200) открываются асинхронно на старте — после
// getSettings и по startParam, — то есть могут оказаться в стеке НИЖЕ листа,
// открытого из startParam раньше. Визуально они сверху всегда, поэтому и
// «Назад» обязан закрывать их первыми, а не невидимый нижний лист.
const MODAL_KEYS: readonly OverlaySheetKey[] = ['addressPicker', 'joinConfirm'];

type StackInput = Pick<SheetsValues, OverlaySheetKey> & {
  openOrder: readonly SheetKey[];
};

/** Верхний открытый лист из реестра OVERLAY_SHEET_KEYS, null — ничего не открыто. */
export function topOverlayKey(sheets: StackInput): OverlaySheetKey | null {
  const open = OVERLAY_SHEET_KEYS.filter((k) => sheets[k]);
  // Открытый лист без записи в порядке (состояние собрано мимо open) — ниже
  // всех: лучше закрыть его последним, чем потерять совсем.
  const ordered = [
    ...open.filter((k) => !sheets.openOrder.includes(k)),
    ...sheets.openOrder.filter((k): k is OverlaySheetKey =>
      (open as readonly SheetKey[]).includes(k),
    ),
  ];
  const modal = ordered.filter((k) => MODAL_KEYS.includes(k));
  const pool = modal.length > 0 ? modal : ordered;
  return pool[pool.length - 1] ?? null;
}
