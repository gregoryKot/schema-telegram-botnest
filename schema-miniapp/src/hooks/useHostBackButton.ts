import { useEffect, useMemo, useRef } from 'react';
import { getHost } from '../../../shared/src/host';
import type { PairsData } from '../api';
import { buildOverlayClosers } from './overlayClosers';
import { topOverlayKey } from './sheetsStack';
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
// У web-хоста своей кнопки нет (getHost().capabilities.backButton === false):
// без замены её ролью браузерная «Назад» просто уводила бы со страницы,
// закрывая приложение целиком, вместо того чтобы закрыть открытый лист.
// Замена — история браузера: pushState при открытии, popstate закрывает
// верхний оверлей. В мини-аппе НЕТ react-router (в отличие от webapp, где
// это делает useHistorySheet через useNavigate) — прямая работа с
// history.pushState/popstate здесь не нарушает запрет из CLAUDE.md
// («не использовать history.pushState напрямую»): тот запрет — про webapp,
// где react-router слушает те же события и конфликтует с прямым вызовом.
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
  const anyOpen = !!newDiaryEntry || top !== null || inClientCabinet;

  useEffect(() => {
    backHandlerRef.current = newDiaryEntry
      ? () => setNewDiaryEntry(null)
      : top
        ? closers[top]
        : inClientCabinet
          ? () => therapistBackHandlerRef.current()
          : () => {};
    getHost().backButton.setVisible(anyOpen);
  }, [newDiaryEntry, top, closers, inClientCabinet, anyOpen]);

  useEffect(
    () => getHost().backButton.onClick(() => backHandlerRef.current()),
    [],
  );

  // ── История браузера — роль кнопки «назад» у хоста, у которого своей нет ──
  //
  // Два флага, а не один: наш собственный history.back() (уборка после
  // закрытия крестиком) тоже порождает popstate, и отличить его от нажатия
  // пользователя по одному флагу нельзя. Раньше на этом запись истории
  // «протекала»: после закрытия крестиком следующее закрытие считало себя
  // ушедшим через «Назад», лишняя запись оставалась, и одно нажатие «Назад»
  // срабатывало вхолостую.
  //   selfBackRef — popstate вызвали мы сами, обработчик звать не надо;
  //   heldRef     — держим ли мы сейчас запись истории.
  const selfBackRef = useRef(false);
  const heldRef = useRef(false);
  useEffect(() => {
    if (getHost().capabilities.backButton) return;
    const onPopState = () => {
      if (selfBackRef.current) {
        selfBackRef.current = false;
        return;
      }
      // Запись сняли не мы — значит пользователь нажал «Назад».
      heldRef.current = false;
      backHandlerRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (getHost().capabilities.backButton) return;
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = anyOpen;
    if (!wasOpen && anyOpen) {
      // Лист открылся — заводим запись истории, чтобы «Назад» его закрыл.
      window.history.pushState({ __miniappSheetOpen: true }, '');
      heldRef.current = true;
    } else if (wasOpen && !anyOpen && heldRef.current) {
      // Закрылось не через «Назад» (крестик, сохранение) — снимаем свою
      // запись сами, иначе она копится. Через «Назад» сюда не попадаем:
      // там браузер уже снял запись и heldRef погашен.
      heldRef.current = false;
      selfBackRef.current = true;
      window.history.back();
    }
  }, [anyOpen]);
  // Известное ограничение: запись одна на «есть хоть один открытый лист», а не
  // на каждый. У вложенных листов (trackerOverlay → trackerGoal) первое «Назад»
  // закроет верхний, а второе уйдёт со страницы. Это всё равно лучше прежнего
  // поведения, где «Назад» уводил со страницы сразу; на стек записей перейдём,
  // когда вложенность станет обычным делом, а не парой экранов.
  return closers;
}
