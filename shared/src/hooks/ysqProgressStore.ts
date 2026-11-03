import { useEffect } from 'react';
import { YSQ_PROGRESS_KEY } from './ysqStorageKeys';

// Незаконченный тест YSQ на этом устройстве: запись в localStorage и событие
// окну. Тест открывается поверх экрана «Мои паттерны» (обе площадки), а тот
// грузил прогресс один раз при открытии — после «✕» карточка звала «Начать
// тест», хотя на сервере уже было 5 ответов, и «Продолжить (N из 116)»
// появлялось только после перезагрузки (QA 2026-10-26). Событие держит
// карточку в актуальном виде, пока экран смонтирован.

export const YSQ_PROGRESS_EVENT = 'ysq-progress';

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
