import { useEffect, useReducer } from 'react';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from './ysqStorageKeys';

// Незаконченный тест YSQ на этом устройстве: запись в localStorage и событие
// окну. Тест открывается поверх экрана «Мои паттерны» (обе площадки), а тот
// грузил прогресс один раз при открытии — после «✕» карточка звала «Начать
// тест», хотя на сервере уже было 5 ответов, и «Продолжить (N из 116)»
// появлялось только после перезагрузки (QA 2026-10-26). Событие держит
// карточку в актуальном виде, пока экран смонтирован.
//
// Тот же класс с итогом (QA 2026-11, B-З5): после «Сохранить и закрыть»
// «Мои паттерны» до F5 звали «Начать тест» и показывали пустые выраженные
// схемы — профиль (ysq.activeSchemaIds) читался один раз. Второе событие —
// «итог на сервере изменился»; экраны по нему перечитывают профиль, а кеш
// GET /api/profile сбрасывает сама мутация (apiCacheRules.data.ts).

export const YSQ_PROGRESS_EVENT = 'ysq-progress';
export const YSQ_RESULT_EVENT = 'ysq-result';

function emit(answered: number | null): void {
  window.dispatchEvent(
    new CustomEvent<number | null>(YSQ_PROGRESS_EVENT, { detail: answered }),
  );
}

/** Сохранить прогресс и сообщить экранам, сколько ответов уже есть. */
export function writeYsqProgress(answers: number[], page: number): void {
  localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ answers, page }));
  emit(answers.filter((a) => a > 0).length);
}

/** Незаконченного теста больше нет (сдан, начат заново, удалён). */
export function clearYsqProgress(): void {
  localStorage.removeItem(YSQ_PROGRESS_KEY);
  emit(null);
}

/** Итог теста на сервере сохранён или удалён — экранам перечитать профиль. */
export function notifyYsqResultChanged(): void {
  window.dispatchEvent(new Event(YSQ_RESULT_EVENT));
}

/** Подписка экрана на изменения прогресса: число ответов или null. */
export function useYsqProgressListener(
  onChange: (answered: number | null) => void,
): void {
  useEffect(() => {
    const h = (e: Event) => onChange((e as CustomEvent<number | null>).detail);
    window.addEventListener(YSQ_PROGRESS_EVENT, h);
    return () => window.removeEventListener(YSQ_PROGRESS_EVENT, h);
  }, [onChange]);
}

/** Счётчик сохранений итога: зависимость эффекта, который грузит профиль. */
export function useYsqResultVersion(): number {
  const [version, bump] = useReducer((v: number) => v + 1, 0);
  useEffect(() => {
    window.addEventListener(YSQ_RESULT_EVENT, bump);
    return () => window.removeEventListener(YSQ_RESULT_EVENT, bump);
  }, []);
  return version;
}

/** Есть ли на устройстве итог и незаконченный тест — живое, без перезагрузки. */
export function useYsqLocalState(): {
  hasResult: boolean;
  hasProgress: boolean;
} {
  const [, rerender] = useReducer((v: number) => v + 1, 0);
  useYsqProgressListener(rerender);
  return {
    hasResult: !!localStorage.getItem(YSQ_RESULT_KEY),
    hasProgress: !!localStorage.getItem(YSQ_PROGRESS_KEY),
  };
}
