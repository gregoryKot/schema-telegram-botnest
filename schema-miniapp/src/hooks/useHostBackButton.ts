import { useEffect, useRef } from 'react';
import { getHost } from '../../../shared/src/host';
import { api, PairsData } from '../api';
import { UseSheetsReturn } from './useSheets';

interface Args {
  sheets: UseSheetsReturn;
  newDiaryEntry: 'schema' | 'mode' | 'gratitude' | null;
  setNewDiaryEntry: (v: 'schema' | 'mode' | 'gratitude' | null) => void;
  therapistMode: boolean;
  cabinetView: 'list' | 'client';
  therapistBackHandlerRef: { current: () => void };
  setPairData: (data: PairsData) => void;
}

// Управление кнопкой «назад» — какой оверлей закрывать и когда её вообще
// показывать. Изначально был Telegram BackButton (см. историю файла как
// useTelegramBackButton.ts — переименован: имя врало, кнопка есть и у MAX);
// поведение хостов С своей кнопкой (Telegram/MAX) не тронуто ни на байт.
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
}: Args) {
  const backHandlerRef = useRef<() => void>(() => {});
  const anyOpen = !!(
    newDiaryEntry ||
    sheets.trackerOverlay ||
    sheets.tracker ||
    sheets.diaries ||
    sheets.schemaInfo ||
    sheets.settings ||
    sheets.practices ||
    sheets.plans ||
    sheets.about ||
    sheets.pairSheet ||
    sheets.childhoodWheel ||
    sheets.todayNote ||
    (therapistMode && cabinetView === 'client')
  );

  useEffect(() => {
    backHandlerRef.current = newDiaryEntry
      ? () => setNewDiaryEntry(null)
      : sheets.trackerOverlay
        ? () => sheets.close('trackerOverlay', { trackerNeedId: null })
        : sheets.tracker
          ? () => sheets.close('tracker', { trackerTab: 'today' })
          : sheets.diaries
            ? () => sheets.close('diaries')
            : sheets.schemaInfo
              ? () => sheets.close('schemaInfo', { schemaAutoStartTest: false })
              : sheets.settings
                ? () => sheets.close('settings')
                : sheets.practices
                  ? () => sheets.close('practices')
                  : sheets.plans
                    ? () => sheets.close('plans')
                    : sheets.about
                      ? () => sheets.close('about')
                      : sheets.pairSheet
                        ? () => {
                            sheets.close('pairSheet');
                            void api.getPair().then(setPairData);
                          }
                        : sheets.childhoodWheel
                          ? () => sheets.close('childhoodWheel')
                          : sheets.todayNote
                            ? () => sheets.close('todayNote')
                            : therapistMode && cabinetView === 'client'
                              ? () => therapistBackHandlerRef.current()
                              : () => {};
    getHost().backButton.setVisible(anyOpen);
  }, [
    newDiaryEntry,
    sheets.trackerOverlay,
    sheets.tracker,
    sheets.diaries,
    sheets.schemaInfo,
    sheets.settings,
    sheets.practices,
    sheets.plans,
    sheets.about,
    sheets.pairSheet,
    sheets.childhoodWheel,
    sheets.todayNote,
    therapistMode,
    cabinetView,
    anyOpen,
  ]);

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
  // на каждый. У вложенных листов (tracker → trackerOverlay) первое «Назад»
  // закроет верхний, а второе уйдёт со страницы. Это всё равно лучше прежнего
  // поведения, где «Назад» уводил со страницы сразу; на стек записей перейдём,
  // когда вложенность станет обычным делом, а не парой экранов.
}
