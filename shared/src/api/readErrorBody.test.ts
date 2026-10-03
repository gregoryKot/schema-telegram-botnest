import { describe, it, expect } from 'vitest';
import { readErrorBody } from './readErrorBody';

const res = (body: string, status: number) => new Response(body, { status });

describe('readErrorBody', () => {
  it('message и reason из JSON-тела', async () => {
    const r = res('{"message":"уже есть","reason":"already_connected"}', 409);
    await expect(readErrorBody(r)).resolves.toEqual({
      message: 'уже есть',
      reason: 'already_connected',
    });
  });

  it('без reason — поле отсутствует', async () => {
    await expect(
      readErrorBody(res('{"message":"плохо"}', 400)),
    ).resolves.toEqual({
      message: 'плохо',
    });
  });

  it('message-массив (ValidationPipe) склеивается в JSON-строку', async () => {
    const r = await readErrorBody(res('{"message":["a","b"]}', 400));
    expect(r.message).toBe('["a","b"]');
  });

  it('не-JSON тело — сообщение по статусу', async () => {
    await expect(readErrorBody(res('<html>502</html>', 502))).resolves.toEqual({
      message: 'API error: 502',
    });
  });

  it('пустое тело — сообщение по статусу', async () => {
    await expect(readErrorBody(res('', 500))).resolves.toEqual({
      message: 'API error: 500',
    });
  });

  it('reason не строка — игнорируется', async () => {
    const r = await readErrorBody(res('{"message":"x","reason":5}', 409));
    expect(r.reason).toBeUndefined();
  });
});
