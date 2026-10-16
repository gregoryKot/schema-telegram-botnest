import { useEffect, useRef, useSyncExternalStore } from 'react';

// Локальные слои «Назад»: оверлей, который живёт НЕ в useSheets, а в состоянии
// компонента внутри листа (чек-ин «Режим прямо сейчас» в справочнике схем).
// Без слоя «Назад» хоста знал только про лист и закрывал справочник целиком
// вместе с чек-ином (находка аудита 2026-10). Слой — модульный стек: монтируется
// оверлей — встал наверх, размонтировался — снят. useHostBackButton спрашивает
// верхний слой раньше реестра листов.
//
// Сознательно НЕ реестр useSheets: чек-ину нечего делать в OVERLAY_SHEET_KEYS —
// он не подменяет секции inert'ом и не открывается снаружи, а проброс
// sheets.open ради локального шага добавил бы связность. Остальные локальные
// оверлеи (ShareCardSheet в ModesTab, AppDiaryNav.activeOverlay) к слоям пока
// не подключены — docs/README.md, «Что осталось открытым».
interface Layer {
  close: () => void;
}

let stack: readonly Layer[] = [];
const listeners = new Set<() => void>();

function setStack(next: readonly Layer[]) {
  stack = next;
  listeners.forEach((l) => l());
}

/** Поставить слой наверх стека. Возвращает функцию снятия (идемпотентную). */
export function pushBackLayer(close: () => void): () => void {
  const layer: Layer = { close };
  setStack([...stack, layer]);
  return () => {
    if (stack.includes(layer)) setStack(stack.filter((l) => l !== layer));
  };
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getTop = (): Layer | null => stack[stack.length - 1] ?? null;

/**
 * Закрыть верхний слой. Для «Назад» хоста: функция закрытия верхнего слоя или
 * null, если слоёв нет. Реактивна — меняется, когда слои появляются/исчезают.
 */
export function useTopBackLayerClose(): (() => void) | null {
  const top = useSyncExternalStore(subscribe, getTop, getTop);
  return top ? top.close : null;
}

/**
 * Пока компонент смонтирован, «Назад» хоста закрывает ЕГО (если он верхний
 * слой), а не лист под ним. `close` берётся свежим при каждом нажатии — слой
 * не пересоздаётся от смены замыкания.
 */
export function useBackLayer(close: () => void): void {
  const ref = useRef(close);
  useEffect(() => {
    ref.current = close;
  });
  useEffect(() => pushBackLayer(() => ref.current()), []);
}
