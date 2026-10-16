import { useEffect, useRef } from 'react';
import { getHost } from '../../../shared/src/host';

// ── История браузера — роль кнопки «назад» у хоста, у которого своей нет ──
// Вынесено из useHostBackButton (правило №10). У web-хоста своей кнопки нет
// (getHost().capabilities.backButton === false): без замены её ролью браузерная
// «Назад» уводила бы со страницы, закрывая приложение целиком, вместо того чтобы
// закрыть открытый лист. В мини-аппе НЕТ react-router (в отличие от webapp, где
// это делает useHistorySheet через useNavigate) — прямая работа с
// history.pushState/popstate здесь не нарушает запрет из CLAUDE.md: тот запрет —
// про webapp, где react-router слушает те же события и конфликтует с прямым
// вызовом.
export function useHostHistoryBack(
  anyOpen: boolean,
  backHandlerRef: { current: () => void },
) {
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
  }, [backHandlerRef]);

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
}
