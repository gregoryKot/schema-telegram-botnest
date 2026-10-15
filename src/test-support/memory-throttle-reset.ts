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
// @nestjs/throttler 6.7.1 (проверено на пакете, без установки): таймеров на
// хит там нет, а `onApplicationShutdown` чистит и `hitExpirations`, и `_storage`.
// Поэтому тот же сброс работает в обеих версиях; контроль в спеке принимает обе
// формы провала «стёрли одну Map» (таймер падает / счётчик живёт).
//
// С разбора прод ушёл со штатного хранилища на MemoryThrottleStorage
// (src/api/memory-throttle-storage.ts): таймеров у него нет, и сброс — просто
// стереть Map. Для голого ThrottlerStorageService (сборка без гибрида, контроль
// в спеках) прежний путь остаётся: сперва отменить таймеры
// (onApplicationShutdown — публичный метод хранилища, ровно это и делает),
// потом стереть записи. После сброса хранилище в том же состоянии, что свежее.
import type { ThrottlerStorageService } from '@nestjs/throttler';
import type { MemoryThrottleStorage } from '../api/memory-throttle-storage';

type Library = Pick<
  ThrottlerStorageService,
  'storage' | 'onApplicationShutdown'
>;
type Own = Pick<MemoryThrottleStorage, 'reset'>;

/**
 * Хранилище в памяти: вложенное `.memory` у HybridThrottleStorage
 * (src/api/hybrid-throttle-storage.ts — немаркированные ключи, в том числе
 * `/api/auth/refresh`), MemoryThrottleStorage само или ThrottlerStorageService.
 * Другая форма — громкая ошибка: тихий no-op вернул бы утечку лимита между
 * сценариями, и тест падал бы на 429 вместо того, чтобы назвать причину.
 */
function memoryOf(storage: object): Partial<Own & Library> {
  return ('memory' in storage ? storage.memory : storage) as Partial<
    Own & Library
  >;
}

/** Обнуляет счётчики в памяти, не оставляя таймеров без записей. */
export function resetMemoryThrottle(storage: object): void {
  const memory = memoryOf(storage);
  if (typeof memory?.reset === 'function') return memory.reset();
  if (
    typeof memory?.storage?.clear !== 'function' ||
    typeof memory.onApplicationShutdown !== 'function'
  ) {
    throw new Error(
      'resetMemoryThrottle: не найдено in-memory хранилище троттлера ' +
        '(ни `.memory` у HybridThrottleStorage, ни MemoryThrottleStorage, ' +
        'ни ThrottlerStorageService)',
    );
  }
  memory.onApplicationShutdown();
  memory.storage.clear();
}
