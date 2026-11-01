import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Отложенное автосохранение, привязанное к ВЛАДЕЛЬЦУ правки (клиент, карта
// режимов) и досылаемое при уходе. Одна механика на все автосохранения сайта
// (правило «одна механика — один компонент»): раньше карта режимов досылала
// правку только при размонтировании, а концептуализация клиента не досылала
// вовсе и брала id и данные в разные моменты.
//
// Инцидент 2026-10-26 (docs/INCIDENTS.md, класс «состояние одного клиента
// протекает в другого»): таймер концептуализации брал id клиента из
// замыкания, а данные — из рефа, который к срабатыванию уже заполнил
// следующий клиент; у прежнего на сервере оказывалась чужая концептуализация
// или пустая. Поэтому здесь ключ и данные запоминаются ВМЕСТЕ, в момент
// правки, и уходят только вместе:
// - правка с другим ключом сначала досылает ожидающую прежнего ключа;
// - `flush()` досылает сразу (смена клиента, закрытие карточки);
// - `pagehide`, скрытие вкладки и размонтирование досылают сразу с
//   `leaving: true` — отправитель ставит keepalive, иначе браузер обрывает
//   запрос вместе со страницей и правка последних N мс теряется.
// Отказ досылки при уходе показать некому — он уходит в `onLeaveError`.

export interface PendingSaveOptions<K, P> {
  delayMs: number;
  /** `leaving` — страница уходит или хук размонтирован: keepalive, без setState. */
  send: (key: K, payload: P, how: { leaving: boolean }) => unknown;
  onLeaveError: (error: unknown) => void;
  /** Сравнение ключей; по умолчанию `Object.is` (id клиента сравнивают `sameId`). */
  isSameKey?: (a: K, b: K) => boolean;
}

export interface PendingSave<K, P> {
  schedule: (key: K, payload: P) => void;
  /** Отправить ожидающее сохранение сейчас (обычным запросом). */
  flush: () => void;
  /** Отправить ожидающее сохранение сейчас как досылку при уходе. */
  leave: () => void;
}

export function createPendingSave<K, P>(
  getOptions: () => PendingSaveOptions<K, P>,
): PendingSave<K, P> {
  let pending: { key: K; payload: P } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function take() {
    if (timer) clearTimeout(timer);
    timer = null;
    const taken = pending;
    pending = null;
    return taken;
  }

  function sendNow(leaving: boolean) {
    const taken = take();
    if (!taken) return;
    const { send, onLeaveError } = getOptions();
    if (!leaving) {
      // Обычная отправка: статус и ошибки ведёт сам отправитель (его catch).
      send(taken.key, taken.payload, { leaving: false });
      return;
    }
    // Promise.resolve — отправитель (мок в тесте) может вернуть не промис;
    // try — синхронный бросок в обработчике pagehide/очистке эффекта иначе
    // ушёл бы мимо телеметрии.
    try {
      void Promise.resolve(
        send(taken.key, taken.payload, { leaving: true }),
      ).catch(onLeaveError);
    } catch (error) {
      onLeaveError(error);
    }
  }

  return {
    schedule(key, payload) {
      const { delayMs, isSameKey = Object.is } = getOptions();
      if (pending && !isSameKey(pending.key, key)) sendNow(false);
      if (timer) clearTimeout(timer);
      pending = { key, payload };
      timer = setTimeout(() => sendNow(false), delayMs);
    },
    flush: () => sendNow(false),
    leave: () => sendNow(true),
  };
}

export function usePendingSave<K, P>(
  options: PendingSaveOptions<K, P>,
): PendingSave<K, P> {
  // Свежие options читаются в момент отправки, а не при создании: send
  // замыкает состояние хука-владельца текущего рендера.
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });
  const [saver] = useState(() =>
    createPendingSave<K, P>(() => optionsRef.current),
  );

  useEffect(() => {
    const onPageHide = () => saver.leave();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saver.leave();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      saver.leave();
    };
  }, [saver]);

  return saver;
}
