import { useEffect, useRef } from 'react';

// «Список заданий на сервере поменялся не из этого экрана» — событие окну.
// QA 2026-11 (К1): запрос терапевта пройти тест на схемы — задание, и его
// закрывает сам сервер, когда тест сохранён (src/bot/ysq.service.ts). Тест
// проходят поверх «Сегодня»/«Помощи», и экран под ним не знал, что задание уже
// выполнено: строка «Пройти тест на схемы» висела до перезагрузки. Тот же
// приём, что у прогресса теста (hooks/ysqProgressStore.ts): экраны со списком
// заданий подписываются и перечитывают его.

export const TASKS_CHANGED_EVENT = 'tasks-changed';

/** Сообщить экранам со списком заданий, что его стоит перечитать. */
export function notifyTasksChanged(): void {
  window.dispatchEvent(new Event(TASKS_CHANGED_EVENT));
}

/**
 * Подписка экрана: `onChange` зовётся на каждое событие. Колбэк берётся
 * свежий (ref), подписка одна на время жизни экрана — новый колбэк на
 * каждом рендере не переподписывает слушатель.
 */
export function useTasksChanged(onChange: () => void): void {
  const ref = useRef(onChange);
  useEffect(() => {
    ref.current = onChange;
  });
  useEffect(() => {
    const h = () => ref.current();
    window.addEventListener(TASKS_CHANGED_EVENT, h);
    return () => window.removeEventListener(TASKS_CHANGED_EVENT, h);
  }, []);
}
