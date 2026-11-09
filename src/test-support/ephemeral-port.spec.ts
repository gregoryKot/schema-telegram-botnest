// Хелпер порта для спеков с поздним биндом (ephemeral-port.ts): поздний бинд
// переживает занятый порт, пока тот не освободится, и не глотает чужие ошибки.
import { connect, createServer, Server } from 'net';
import { existsSync, readFileSync } from 'fs';
import {
  listenOn,
  listenWithRetry,
  REFUSED_PORT,
  reservePort,
} from './ephemeral-port';

const close = (s: Server) => new Promise<void>((r) => s.close(() => r()));

describe('ephemeral-port', () => {
  it('reservePort отдаёт номер, на котором сразу можно слушать', async () => {
    const port = await reservePort();
    expect(port).toBeGreaterThan(0);
    const s = createServer();
    await expect(listenOn(s, port)).resolves.toBe(port);
    await close(s);
  });

  it('порт занят чужим слушателем → listenWithRetry дожидается освобождения', async () => {
    const squatter = createServer();
    const port = await listenOn(squatter);
    setTimeout(() => squatter.close(), 120); // освобождается позже первой попытки
    const s = await listenWithRetry(() => createServer(), port);
    expect(s.listening).toBe(true);
    await close(s);
  });

  // Контроль: без ретраев (attempts = 0) тот же сценарий краснеет EADDRINUSE.
  it('бюджет исчерпан → EADDRINUSE наружу', async () => {
    const squatter = createServer();
    const port = await listenOn(squatter);
    await expect(
      listenWithRetry(() => createServer(), port, 0),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' });
    await close(squatter);
  });

  it('не EADDRINUSE (неверный порт) — бросается сразу, без ретраев', async () => {
    const make = jest.fn(() => createServer());
    await expect(listenWithRetry(make, 70_000)).rejects.toThrow();
    expect(make).toHaveBeenCalledTimes(1);
  });
});

// «БД недоступна» на номере от reservePort() мигнуло в полном jest (run
// 42287170557): отпущенный номер занял соседний воркер, и TCP-проба БД прошла.
describe('REFUSED_PORT: connect гарантированно отказан', () => {
  it('вне эфемерного диапазона ядра — ни listen(0), ни исходящий сокет его не возьмут', () => {
    const range = '/proc/sys/net/ipv4/ip_local_port_range';
    const low = existsSync(range)
      ? Number(readFileSync(range, 'utf8').trim().split(/\s+/)[0])
      : 1024; // не Linux: хотя бы привилегированный порт
    expect(REFUSED_PORT).toBeGreaterThan(0);
    expect(REFUSED_PORT).toBeLessThan(Math.min(low, 1024));
  });

  it('connect на 127.0.0.1:REFUSED_PORT — ECONNREFUSED', async () => {
    const code = await new Promise<string>((resolve) => {
      const s = connect(REFUSED_PORT, '127.0.0.1');
      s.once('connect', () => {
        s.destroy();
        resolve('connected');
      });
      s.once('error', (e: NodeJS.ErrnoException) => resolve(e.code ?? '?'));
    });
    expect(code).toBe('ECONNREFUSED');
  });
});
