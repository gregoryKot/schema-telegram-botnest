// Флаг «в полёте»: прогон расписания — в channel-schedule.inflight.spec.ts.
// Здесь синхронный захват, который делят расписание и /zv (хвост R7, аудит
// 2026-11): кто держит флаг и что повторное освобождение не снимает чужой.
import { OneAtATime } from './one-at-a-time';

describe('OneAtATime.claim', () => {
  it('занято — null и имя того, кто держит; освободили — снова свободно', () => {
    const gate = new OneAtATime();
    const release = gate.claim('пост по расписанию');
    expect(release).not.toBeNull();
    expect(gate.claim('/zv')).toBeNull();
    expect(gate.holder).toBe('пост по расписанию');
    release?.();
    expect(gate.holder).toBeNull();
    expect(gate.claim('/zv')).not.toBeNull();
  });

  it('повторное освобождение не снимает флаг следующего владельца', () => {
    const gate = new OneAtATime();
    const first = gate.claim('/zv');
    first?.();
    gate.claim('пост по расписанию');
    first?.();
    expect(gate.holder).toBe('пост по расписанию');
  });

  it('run держит флаг на время прогона и снимает его даже при падении', async () => {
    const gate = new OneAtATime();
    let seen: string | null = null;
    await expect(
      gate.run(async () => {
        seen = gate.holder;
        throw new Error('db down');
      }, 'досылка'),
    ).rejects.toThrow('db down');
    expect(seen).toBe('досылка');
    expect(gate.holder).toBeNull();
  });
});
