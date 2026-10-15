import { markAddressFormAsked } from '../../../shared/src/settings/addressFormPrompt';
import { api, PairsData } from '../api';
import type { OverlaySheetKey } from './sheetsStack';
import type { SheetKey, UseSheetsReturn } from './useSheets';

export interface ClosersDeps {
  sheets: Pick<UseSheetsReturn, 'open' | 'close'>;
  childhoodWheelPending: boolean;
  setChildhoodWheelPending: (v: boolean) => void;
  onAddressPickerDone: () => void;
  setPairData: (data: PairsData) => void;
}

// Один реестр «как закрывается лист»: крестик листа (AppOverlays) и «Назад»
// хоста (useHostBackButton) зовут ОДНУ функцию. Раньше у «Назад» была своя
// лесенка: она не знала четыре листа и теряла побочные эффекты крестика
// (отложенное колесо детства после заметки, сброс подсветки схемы).
// Новый ключ в OVERLAY_SHEET_KEYS без записи здесь не компилируется.
export function buildOverlayClosers(
  deps: ClosersDeps,
): Record<OverlaySheetKey, () => void> {
  const { sheets, childhoodWheelPending } = deps;
  const plain = (key: SheetKey) => () => sheets.close(key);
  return {
    about: plain('about'),
    // «Позже» из AddressFormPicker: мягкий пропуск (спросим снова через
    // неделю), а не голое закрытие, которое заблокировало бы онбординг.
    addressPicker: () => {
      markAddressFormAsked();
      sheets.close('addressPicker');
      deps.onAddressPickerDone();
    },
    caseFlow: plain('caseFlow'),
    childhoodWheel: plain('childhoodWheel'),
    diaries: plain('diaries'),
    joinConfirm: () =>
      sheets.close('joinConfirm', { joinKind: null, joinCode: null }),
    pairSheet: () => {
      sheets.close('pairSheet');
      void api.getPair().then(deps.setPairData);
    },
    plans: plain('plans'),
    practices: plain('practices'),
    schemaInfo: () =>
      sheets.close('schemaInfo', {
        schemaAutoStartTest: false,
        schemaHighlight: undefined,
      }),
    selfMap: plain('selfMap'),
    settings: plain('settings'),
    todayNote: () => {
      sheets.close('todayNote');
      if (childhoodWheelPending) {
        deps.setChildhoodWheelPending(false);
        sheets.open('childhoodWheel');
      }
    },
    tracker: () => sheets.close('tracker', { trackerTab: 'today' }),
    trackerGoal: plain('trackerGoal'),
    trackerOverlay: () =>
      sheets.close('trackerOverlay', { trackerNeedId: null }),
  };
}
