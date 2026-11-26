// Сброс счётчиков троттлера в памяти процесса между e2e-сценариями одного
// файла (test/refresh-rotation.e2e-spec.ts: `/api/auth/refresh` троттлится
// 20/1000мс по IP, а у supertest IP один на весь файл).
//
// Разбор 2026-10-15 (мигалка refresh-rotation на живом Postgres): прежний
// сброс стирал только Map записей штатного хранилища (`.storage.clear()`).
// На 6.5.0 таймеры истечения, которые библиотека ставила на КАЖДЫЙ хит,
// оставались жить и падали TypeError на пропавшей записи (uncaught, Jest 30
// приписывал его случайному тесту файла). На 6.7.1 таймеров на хит нет, но
// хиты живут во второй Map (`hitExpirations`): стерев одну `storage`, следующий
// хит того же ключа восстанавливает старый счёт — лимит утекает между
// сценариями. Обе Map и таймер выметания чистит `onApplicationShutdown` —
// публичный метод хранилища; после него хранилище в состоянии свежего, а
// таймер выметания заводится заново на следующем хите.
import type { ThrottlerStorageService } from '@nestjs/throttler';

type Library = Pick<
  ThrottlerStorageService,
  'storage' | 'onApplicationShutdown'
>;

/**
 * Хранилище в памяти: вложенное `.memory` у HybridThrottleStorage
 * (src/api/hybrid-throttle-storage.ts — немаркированные ключи, в том числе
 * `/api/auth/refresh`) или ThrottlerStorageService само. Другая форма —
 * громкая ошибка: тихий no-op вернул бы утечку лимита между сценариями, и
 * тест падал бы на 429 вместо того, чтобы назвать причину.
 */
function memoryOf(storage: object): Partial<Library> | undefined {
  return ('memory' in storage ? storage.memory : storage) as
    Partial<Library> | undefined;
}

/** Обнуляет счётчики в памяти вместе с таймером выметания. */
export function resetMemoryThrottle(storage: object): void {
  const memory = memoryOf(storage);
  if (
    typeof memory?.storage?.clear !== 'function' ||
    typeof memory.onApplicationShutdown !== 'function'
  ) {
    throw new Error(
      'resetMemoryThrottle: не найдено in-memory хранилище троттлера ' +
        '(ни `.memory` у HybridThrottleStorage, ни ThrottlerStorageService)',
    );
  }
  memory.onApplicationShutdown();
  memory.storage.clear();
}
