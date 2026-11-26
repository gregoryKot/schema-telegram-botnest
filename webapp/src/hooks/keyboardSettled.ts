// Когда экранная клавиатура iOS убрана НАСОВСЕМ — а не когда ушёл фокус.
// Инцидент 2026-11-05 (скрин владельца, карта режимов): нижняя навигация
// висела посреди экрана. MobileNav прячется на фокусе в поле и возвращается
// на focusout, а focusout приходит в самом начале закрытия клавиатуры, когда
// окно у WebKit ещё укорочено на её высоту. `position: fixed; bottom: 0`
// встаёт на низ укороченного окна, и iOS (Safari, установленное приложение)
// не пересчитывает fixed-элементы после ухода клавиатуры, пока страница не
// прокрутится. Здесь: ждём, пока visualViewport снова станет высотой с окно,
// затем нулевая прокрутка — она и заставляет WebKit пересчитать fixed.

/** Страховка: клавиатура закрылась, а resize не пришёл (старый WebKit). */
export const KEYBOARD_SETTLE_FALLBACK_MS = 700;
/** Разница меньше этого — полоса браузера или safe-area, не клавиатура (у неё ≥ 250px). */
export const KEYBOARD_MIN_PX = 100;

export function keyboardOpen(): boolean {
  const vv = window.visualViewport;
  return !!vv && window.innerHeight - vv.height > KEYBOARD_MIN_PX;
}

/** Зовёт cb, когда клавиатуры нет (сразу, если она не открыта). Возвращает отмену. */
export function whenKeyboardSettled(cb: () => void): () => void {
  const vv = window.visualViewport;
  if (!vv || !keyboardOpen()) {
    cb();
    return () => {};
  }
  let done = false;
  const stop = () => {
    done = true;
    vv.removeEventListener('resize', onResize);
    clearTimeout(timer);
  };
  const finish = () => {
    if (done) return;
    stop();
    window.scrollTo(window.scrollX, window.scrollY);
    cb();
  };
  const onResize = () => {
    if (!keyboardOpen()) finish();
  };
  vv.addEventListener('resize', onResize);
  const timer = setTimeout(finish, KEYBOARD_SETTLE_FALLBACK_MS);
  return stop;
}
