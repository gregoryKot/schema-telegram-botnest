// Хелпер порта для спеков с поздним биндом (ephemeral-port.ts): поздний бинд
// переживает занятый порт, пока тот не освободится, и не глотает чужие ошибки.
import { createServer, Server } from 'net';
import { listenOn, listenWithRetry, reservePort } from './ephemeral-port';

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
