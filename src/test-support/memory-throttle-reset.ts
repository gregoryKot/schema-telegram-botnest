// Сброс счётчиков троттлера в памяти процесса между e2e-сценариями одного
// файла (test/refresh-rotation.e2e-spec.ts: `/api/auth/refresh` троттлится
// 20/1000мс по IP, а у supertest IP один на весь файл).
//
// Разбор 2026-10-15 (мигалка refresh-rotation на живом Postgres). Прежний
// сброс стирал только Map записей штатного ThrottlerStorageService
// (`.storage.clear()`). Таймеры истечения, которые библиотека ставит на КАЖДЫЙ
// хит (1 с у `short`, 60 с у `long`), оставались жить, а колбэк таймера берёт
// запись без проверки — `const { totalHits } = this.storage.get(key)`
// (@nestjs/throttler 6.5.0, throttler.service.js, setExpirationTime). Таймер,
// сработавший между сбросом и следующим хитом того же ключа, бросал TypeError
// мимо любого try — uncaught. Jest 30 приписывает такую ошибку тесту, в чьём
// async-контексте таймер СОЗДАН (AsyncLocalStorage), а не идущему: поэтому
// падал «каждый раз другой» из первых тестов файла, хотя сброс стоит только
// в последних четырёх. Окно «сброс → первый хит» — две записи в базу; под
// нагрузкой оно растягивается, и попадание таймера в него становится частым.
// Таймер, сработавший уже ПОСЛЕ нового хита, не падал, но молча вычитал
// единицу из новой записи.
//
// В проде записи из хранилища никто не удаляет (ни библиотека, ни
// HybridThrottleStorage), так что дефект жил только в тестовом сбросе.
//
// Сброс здесь повторяет остановку приложения: сперва отменить таймеры
// (onApplicationShutdown — публичный метод хранилища, ровно это и делает),
// потом стереть записи. После него хранилище в том же состоянии, что свежее.
import type { ThrottlerStorageService } from '@nestjs/throttler';

type MemoryThrottle = Pick<
  ThrottlerStorageService,
  'storage' | 'onApplicationShutdown'
>;

/**
 * Штатное хранилище в памяти: вложенное `.memory` у HybridThrottleStorage
 * (src/api/hybrid-throttle-storage.ts — немаркированные ключи, в том числе
 * `/api/auth/refresh`) или сам ThrottlerStorageService. Другая форма —
 * громкая ошибка: тихий no-op вернул бы утечку лимита между сценариями, и
 * тест падал бы на 429 вместо того, чтобы назвать причину.
 */
function memoryOf(storage: object): MemoryThrottle {
  const candidate = ('memory' in storage ? storage.memory : storage) as
    Partial<MemoryThrottle> | undefined;
  if (
    typeof candidate?.storage?.clear !== 'function' ||
    typeof candidate.onApplicationShutdown !== 'function'
  ) {
    throw new Error(
      'resetMemoryThrottle: не найдено in-memory хранилище троттлера ' +
        '(ни `.memory` у HybridThrottleStorage, ни ThrottlerStorageService)',
    );
  }
  return candidate as MemoryThrottle;
}

/** Обнуляет счётчики в памяти, не оставляя таймеров без записей. */
export function resetMemoryThrottle(storage: object): void {
  const memory = memoryOf(storage);
  memory.onApplicationShutdown();
  memory.storage.clear();
}
