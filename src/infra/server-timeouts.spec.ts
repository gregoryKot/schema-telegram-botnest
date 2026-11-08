// keepAliveTimeout сервера Nest за прокси (docs/open/backend.md, выкладка
// 2026-11-05): по умолчанию Node закрывает простаивающее соединение через 5 с,
// раньше прокси — редкие 503. Значения — на настоящем http.Server, и шов:
// main.ts ставит их после listen.
import { readFileSync } from 'fs';
import { createServer } from 'http';
import { join } from 'path';
import {
  applyServerTimeouts,
  HEADERS_TIMEOUT_MS,
  KEEP_ALIVE_TIMEOUT_MS,
} from './server-timeouts';

describe('таймауты keep-alive HTTP-сервера', () => {
  it('настоящий http.Server: 65 с простоя, заголовки — дольше простоя', () => {
    const server = createServer();
    expect(server.keepAliveTimeout).toBe(5_000); // контроль: дефолт Node
    applyServerTimeouts(server);
    expect(server.keepAliveTimeout).toBe(65_000);
    expect(server.headersTimeout).toBe(66_000);
    expect(server.headersTimeout).toBeGreaterThan(server.keepAliveTimeout);
  });

  it('простой дольше минуты — дольше типичного простоя прокси (60 с)', () => {
    expect(KEEP_ALIVE_TIMEOUT_MS).toBeGreaterThan(60_000);
    expect(HEADERS_TIMEOUT_MS).toBeGreaterThan(KEEP_ALIVE_TIMEOUT_MS);
  });
});

/** main.ts ставит таймауты серверу приложения после listen. */
function appliesAfterListen(src: string): boolean {
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const listen = code.indexOf('await app.listen(');
  const call = code.search(/\bapplyServerTimeouts\(\s*app\.getHttpServer\(\)/);
  return listen >= 0 && call > listen;
}

describe('main.ts ставит таймауты серверу после listen', () => {
  const MAIN = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8');

  it('настоящий main.ts', () => {
    expect(appliesAfterListen(MAIN)).toBe(true);
  });

  it.each([
    ['без вызова', MAIN.replace(/.*applyServerTimeouts\(.*\n/g, '')],
    [
      'вызов закомментирован',
      'await app.listen(port);\n// applyServerTimeouts(app.getHttpServer());\n',
    ],
  ])('контроль: %s → красный', (_name, src) => {
    expect(appliesAfterListen(src)).toBe(false);
  });
});
