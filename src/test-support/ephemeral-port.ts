// Порт для спеков, которым номер нужен ДО того, как на нём кто-то слушает
// (front стартует раньше апстрима, ожидание БД — раньше «пода»).
//
// Класс флака (#547, docs/TEST_IMPROVEMENT_PLAN.md п. 3.4): спек просит у ядра
// свободный порт, отпускает его и занимает позже — в этом окне номер свободен
// для всей машины, и его берёт любой bind соседнего jest-воркера (чаще всего
// локальный порт исходящего соединения). Захардкоженная константа (58123,
// 58124) — та же беда: она лежит в эфемерном диапазоне Linux. Поэтому поздний
// бинд идёт с бюджетом ретраев: порт освобождается за миллисекунды.
// Своя копия «занять и отпустить» вне файла — красный scripts/check-ephemeral-port.mjs.
import { createServer, Server, AddressInfo } from 'net';

/** Слушатель на 127.0.0.1; ошибка бинда — в reject, а не необработанным событием. */
export function listenOn<S extends Server>(
  server: S,
  port = 0,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () =>
      resolve((server.address() as AddressInfo).port),
    );
  });
}

/** Номер, свободный прямо сейчас (занят и сразу отпущен). Занимать его потом — только через listenWithRetry. */
export async function reservePort(): Promise<number> {
  const server = createServer();
  const port = await listenOn(server);
  await new Promise<void>((r) => server.close(() => r()));
  return port;
}

/**
 * Порт, который никто не слушает: connect на 127.0.0.1 сразу получает отказ
 * (ECONNREFUSED). Для «БД недоступна», «апстрима нет» — не reservePort(): его
 * номер свободен и для соседнего воркера, тот садится на него, и проба БД
 * проходит (мигание maintenance-startup.spec.ts, run 42287170557). Порт 1
 * (tcpmux) вне эфемерного диапазона ядра — ни listen(0), ни исходящее
 * соединение его не выдадут; занять его может только root и только явно.
 */
export const REFUSED_PORT = 1;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Бинд на ЗАДАННЫЙ порт: EADDRINUSE повторяется до `attempts` раз с паузой
 * 50 мс, любая другая ошибка бросается сразу. `make` — новый сервер на
 * каждую попытку (закрытый после отказа сервер повторно не слушает).
 */
export async function listenWithRetry<S extends Server>(
  make: () => S,
  port: number,
  attempts = 20,
): Promise<S> {
  for (let i = 0; ; i++) {
    const server = make();
    try {
      await listenOn(server, port);
      return server;
    } catch (e) {
      server.close();
      if (i >= attempts || (e as NodeJS.ErrnoException).code !== 'EADDRINUSE')
        throw e;
      await sleep(50);
    }
  }
}
