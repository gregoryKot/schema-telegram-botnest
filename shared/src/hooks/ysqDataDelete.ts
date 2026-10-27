// Кнопка «Удалить результаты теста» в настройках обоих фронтендов (решение
// владельца 2026-10-22): стирает всё про тест — итог, всю историю прохождений
// и незаконченный прогресс — на сервере (`DELETE /api/ysq-data`) и в
// localStorage. Одна функция и одни тексты на сайт и мини-апп (правило №3).
//
// Порядок важен: локальные ключи уходят только ПОСЛЕ ответа сервера. Раньше
// мини-апп чистил их до запроса и ответ не ждал — при отказе сети экран
// говорил «удалено», а тест оставался на сервере и возвращался при следующем
// входе (приватность). При ошибке ключи не трогаем и пробрасываем её экрану.
//
// «Пройти заново» сюда не ходит: там удаляется только итог, история остаётся
// (`useYsqTest.handleRetake` → `DELETE /api/ysq-result`).
//
// Экраны: webapp/src/components/settingsSheet/YsqDataDeleteButton.tsx (общий
// ConfirmDialog сайта) и schema-miniapp/src/components/settingsSheet/
// YsqDataDelete.tsx (подтверждение прямо в шторке). Вид у площадок свой,
// состояние «спросили → удаляем → ошибка» — одно, `useYsqDataDelete`, и
// видимость кнопки — одна, `useHasYsqData`.
import { useEffect, useState } from 'react';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from './ysqStorageKeys';
import { useConfirmedAction } from './useConfirmedAction';
import type { Tr } from './ysqSchemas';

export interface YsqDataDeleteApi {
  deleteYsqData: () => Promise<unknown>;
}

export async function deleteAllYsqData(api: YsqDataDeleteApi): Promise<void> {
  await api.deleteYsqData();
  localStorage.removeItem(YSQ_PROGRESS_KEY);
  localStorage.removeItem(YSQ_RESULT_KEY);
}

/** Кнопка → подтверждение → удаление; при отказе подтверждение остаётся с ошибкой. */
export function useYsqDataDelete(api: YsqDataDeleteApi, onDeleted: () => void) {
  return useConfirmedAction(() => deleteAllYsqData(api), onDeleted);
}

/** Есть ли на этом устройстве что-то от теста. */
export function hasLocalYsqData(): boolean {
  return (
    !!localStorage.getItem(YSQ_PROGRESS_KEY) ||
    !!localStorage.getItem(YSQ_RESULT_KEY)
  );
}

export interface YsqDataPresenceApi {
  getYsqHistory: () => Promise<readonly unknown[] | null | undefined>;
  getYsqProgress: () => Promise<unknown>;
}

/**
 * Видна ли кнопка: тест есть на этом устройстве — сразу, без сети; иначе —
 * когда сервер ответил непустой историей или прогрессом. Без проверки
 * сервера тест, пройденный на другой площадке, и история после «Пройти
 * заново» без новых ответов не стирались из настроек вовсе. Пока ответа нет
 * и при сбое сети — кнопки нет. GET-ы идут через общий apiCache; после
 * удаления их сбрасывает правило DELETE /api/ysq-data (apiCacheRules.data.ts).
 */
export function useHasYsqData(api: YsqDataPresenceApi): boolean {
  const [local] = useState(hasLocalYsqData);
  const [server, setServer] = useState(false);

  useEffect(() => {
    if (local) return;
    let alive = true;
    // Каждый ответ — отдельное свидетельство: сбой одного не прячет другое.
    void Promise.allSettled([
      Promise.resolve().then(() => api.getYsqHistory()),
      Promise.resolve().then(() => api.getYsqProgress()),
    ]).then(([history, progress]) => {
      const hasHistory =
        history.status === 'fulfilled' &&
        Array.isArray(history.value) &&
        history.value.length > 0;
      const hasProgress = progress.status === 'fulfilled' && !!progress.value;
      if (alive) setServer(hasHistory || hasProgress);
    });
    return () => {
      alive = false;
    };
  }, [api, local]);

  return local || server;
}

/** Тексты кнопки и подтверждения — безличные, одинаковые на обеих площадках. */
export function buildYsqDataDeleteCopy(tr: Tr) {
  return {
    button: 'Удалить результаты теста',
    title: 'Удалить все результаты теста?',
    message:
      'Уйдут итог, все прошлые прохождения и незаконченные ответы. Вернуть их не получится.',
    confirm: 'Удалить всё',
    cancel: 'Отмена',
    busy: 'Удаляю...',
    error: tr(
      'Не удалось удалить. Попробуй ещё раз',
      'Не удалось удалить. Попробуйте ещё раз',
    ),
  };
}
