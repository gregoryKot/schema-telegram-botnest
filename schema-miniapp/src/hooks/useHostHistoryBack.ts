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
// depth — сколько ступеней «Назад» сейчас открыто (лист + слои над ним, см.
// useHostBackButton): на каждую держим свою запись истории.
export function useHostHistoryBack(
  depth: number,
  backHandlerRef: { current: () => void },
) {
  // Два флага, а не один: наш собственный history.back() (уборка после
  // закрытия крестиком) тоже порождает popstate, и отличить его от нажатия
  // пользователя по одному флагу нельзя. Раньше на этом запись истории
  // «протекала»: после закрытия крестиком следующее закрытие считало себя
  // ушедшим через «Назад», лишняя запись оставалась, и одно нажатие «Назад»
  // срабатывало вхолостую.
  //   selfBackRef — popstate вызвали мы сами, обработчик звать не надо;
  //   heldRef     — сколько записей истории мы сейчас держим.
  const selfBackRef = useRef(false);
  const heldRef = useRef(0);
  useEffect(() => {
    if (getHost().capabilities.backButton) return;
    const onPopState = () => {
      if (selfBackRef.current) {
        selfBackRef.current = false;
        return;
      }
      // Запись сняли не мы — значит пользователь нажал «Назад».
      heldRef.current = Math.max(0, heldRef.current - 1);
      backHandlerRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [backHandlerRef]);

  useEffect(() => {
    if (getHost().capabilities.backButton) return;
    const held = heldRef.current;
    if (depth > held) {
      // Открылась ступень — заводим запись истории, чтобы «Назад» её закрыл.
      for (let i = held; i < depth; i += 1) {
        window.history.pushState({ __miniappSheetOpen: true }, '');
      }
      heldRef.current = depth;
    } else if (depth < held) {
      // Закрылось не через «Назад» (крестик, сохранение) — снимаем свои
      // записи сами, иначе они копятся. Через «Назад» сюда не попадаем:
      // там браузер уже снял запись, и heldRef уменьшен.
      const n = held - depth;
      heldRef.current = depth;
      selfBackRef.current = true;
      if (n === 1) window.history.back();
      else window.history.go(-n);
    }
  }, [depth]);
  // Известное ограничение: листы реестра считаются одной ступенью, а не каждый.
  // У вложенных листов (trackerOverlay → trackerGoal) первое «Назад» закроет
  // верхний, а второе уйдёт со страницы. Слои (backLayers) — отдельные ступени.
}
