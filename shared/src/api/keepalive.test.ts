import { describe, it, expect } from 'vitest';
import { KEEPALIVE_BODY_MAX_BYTES, withKeepalive } from './keepalive';

describe('withKeepalive', () => {
  it('без запроса keepalive — init как есть', () => {
    const init = { method: 'POST', body: '{}' };
    expect(withKeepalive(init)).toBe(init);
    expect(withKeepalive(init, { keepalive: false })).toBe(init);
  });

  it('тело в пределе — keepalive: true, остальное сохраняется', () => {
    expect(
      withKeepalive(
        { method: 'POST', body: '{"goals":"цель"}' },
        { keepalive: true },
      ),
    ).toEqual({
      method: 'POST',
      body: '{"goals":"цель"}',
      keepalive: true,
    });
  });

  it('предел считается в байтах UTF-8, а не в знаках: кириллица вдвое тяжелее', () => {
    const half = 'ж'.repeat(KEEPALIVE_BODY_MAX_BYTES / 2); // ровно предел в байтах
    expect(withKeepalive({ body: half }, { keepalive: true }).keepalive).toBe(
      true,
    );
    const over = half + 'ж'; // знаков меньше предела, байтов — больше
    expect(over.length).toBeLessThan(KEEPALIVE_BODY_MAX_BYTES);
    expect(
      withKeepalive({ body: over }, { keepalive: true }).keepalive,
    ).toBeUndefined();
  });
});
