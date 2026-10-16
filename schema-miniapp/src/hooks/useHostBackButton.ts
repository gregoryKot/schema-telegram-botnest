import { useEffect, useMemo, useRef } from 'react';
import { getHost } from '../../../shared/src/host';
import type { PairsData } from '../api';
import { useTopBackLayerClose } from './backLayers';
import { buildOverlayClosers } from './overlayClosers';
import { topOverlayKey } from './sheetsStack';
import { useHostHistoryBack } from './useHostHistoryBack';
import { UseSheetsReturn } from './useSheets';

interface Args {
  sheets: UseSheetsReturn;
  newDiaryEntry: 'schema' | 'mode' | 'gratitude' | null;
  setNewDiaryEntry: (v: 'schema' | 'mode' | 'gratitude' | null) => void;
  therapistMode: boolean;
  cabinetView: 'list' | 'client';
  therapistBackHandlerRef: { current: () => void };
  setPairData: (data: PairsData) => void;
  childhoodWheelPending: boolean;
  setChildhoodWheelPending: (v: boolean) => void;
  onAddressPickerDone: () => void;
}

// Управление кнопкой «назад» — какой оверлей закрывать и когда её вообще
// показывать. Закрывает верхний лист (последний открытый), тем же closer'ом,
// что и крестик листа; closers возвращаются наружу — AppOverlays берёт их же.
// Изначально был Telegram BackButton (см. историю файла как
// useTelegramBackButton.ts — переименован: имя врало, кнопка есть и у MAX).
//
// У web-хоста своей кнопки нет — её роль играет история браузера, см.
// useHostHistoryBack.ts. Локальные оверлеи внутри листов (чек-ин) ставят слой
// через useBackLayer (backLayers.ts): «Назад» закрывает его раньше листа.
export function useHostBackButton({
  sheets,
  newDiaryEntry,
  setNewDiaryEntry,
  therapistMode,
  cabinetView,
  therapistBackHandlerRef,
  setPairData,
  childhoodWheelPending,
  setChildhoodWheelPending,
  onAddressPickerDone,
}: Args) {
  const backHandlerRef = useRef<() => void>(() => {});
  const closers = useMemo(
    () =>
      buildOverlayClosers({
        sheets: { open: sheets.open, close: sheets.close },
        childhoodWheelPending,
        setChildhoodWheelPending,
        onAddressPickerDone,
        setPairData,
      }),
    [
      sheets.open,
      sheets.close,
      childhoodWheelPending,
      setChildhoodWheelPending,
      onAddressPickerDone,
      setPairData,
    ],
  );
  // Верхний лист — последний открытый (sheetsStack), а не первый по лесенке.
  const top = topOverlayKey(sheets);
  const inClientCabinet = therapistMode && cabinetView === 'client';
  // Локальный слой (чек-ин внутри справочника схем) стоит поверх любого листа:
  // «Назад» закрывает сначала его. Слой живёт, пока смонтирован его оверлей,
  // поэтому «слой есть, а листа нет» не бывает.
  const layerClose = useTopBackLayerClose();
  const anyOpen =
    !!newDiaryEntry || top !== null || inClientCabinet || layerClose !== null;

  useEffect(() => {
    backHandlerRef.current = layerClose
      ? layerClose
      : newDiaryEntry
        ? () => setNewDiaryEntry(null)
        : top
          ? closers[top]
          : inClientCabinet
            ? () => therapistBackHandlerRef.current()
            : () => {};
    getHost().backButton.setVisible(anyOpen);
  }, [newDiaryEntry, top, closers, inClientCabinet, anyOpen, layerClose]);

  useEffect(
    () => getHost().backButton.onClick(() => backHandlerRef.current()),
    [],
  );

  useHostHistoryBack(anyOpen, backHandlerRef);
  return closers;
}
