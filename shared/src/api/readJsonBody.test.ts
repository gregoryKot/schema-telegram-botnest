// Инцидент 2026-10-03: сервер на «нет записи» отдаёт пустое тело, а res.json()
// на нём бросает SyntaxError. readJsonBody обязан превратить пустое тело в null,
// но не глотать настоящий мусор.
import { describe, it, expect } from 'vitest';
import { readJsonBody } from './readJsonBody';

describe('readJsonBody', () => {
  it('пустое тело — null, а не SyntaxError', async () => {
    await expect(readJsonBody(new Response(''))).resolves.toBeNull();
  });

  it('тело из одних пробелов и переводов строки — null', async () => {
    await expect(readJsonBody(new Response('  \n\t '))).resolves.toBeNull();
  });

  it('литерал null — null', async () => {
    await expect(readJsonBody(new Response('null'))).resolves.toBeNull();
  });

  it('объект разбирается как обычно', async () => {
    await expect(readJsonBody(new Response('{"a":1}'))).resolves.toEqual({
      a: 1,
    });
  });

  it('непустой невалидный JSON по-прежнему отклоняется', async () => {
    await expect(readJsonBody(new Response('not json'))).rejects.toThrow(
      SyntaxError,
    );
  });
});
