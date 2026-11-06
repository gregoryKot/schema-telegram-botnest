// Автоматическая очистка DOM после каждого теста (vitest setupFiles).
//
// Авто-cleanup @testing-library/react регистрирует afterEach только при
// глобальном afterEach, а `test.globals` у нас выключен. Поэтому смонтированный
// компонент жил до конца файла, его эффекты не размонтировались, и таймер из
// эффекта срабатывал уже после сноса jsdom: «ReferenceError: window is not
// defined» и красная джоба CI (флак 2026-10-15, run 38707373186,
// LazySections.test.tsx → useSafeTop). Явный cleanup() «по памяти автора» был
// только в части файлов; повторный вызов идемпотентен, так что они не мешают.
//
// ПОЧЕМУ ФАЙЛ СВОЙ В КАЖДОМ ПАКЕТЕ, А НЕ ОДИН В shared/ (правило №3 здесь
// не применимо): у каждого пакета свой node_modules/@testing-library/react, и
// cleanup чистит список контейнеров ТОЛЬКО своего экземпляра RTL. Общий файл
// из shared/ чистил бы экземпляр shared, а тесты фронтенда рендерят через свой
// — механизм молча ничего бы не делал. Три копии держит пин-тест рядом.
import { afterAll, afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { settleUnmountTimers } from '../../../shared/src/test-support/settleUnmountTimers';

// Бюджет findBy*/waitFor — на холодный `import()` ленивого чанка: дефолтные
// 1000 мс он под нагрузкой превышает (`TrackerOverlay` 2,1 с при load average
// 55–77 на 8 ядрах; тёплый — 1 мс), и тест краснел при живом экране. Сломанный
// экран не появится и за 5 с — упадёт той же ошибкой. 5000 — вдвое ниже
// `testTimeout` (vite.config.ts): findBy успевает дать свою ошибку с DOM.
export const ASYNC_UTIL_TIMEOUT_MS = 5000;
configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT_MS });

afterEach(() => {
  cleanup();
});

// Последний тест файла: afterEach выше размонтировал компонент, а снос jsdom
// идёт сразу за хуками. @tiptap/react уничтожает редактор по setTimeout(…, 1)
// после размонтирования, и этот таймер срабатывал уже без window —
// «ReferenceError: window is not defined» при зелёных тестах (CI 2026-10-15,
// ArticleEditor.test.tsx; гонка жила с собственного cleanup файла, #293, и
// всплыла впервые). Граница — в шапке settleUnmountTimers.ts.
afterAll(() => settleUnmountTimers());
