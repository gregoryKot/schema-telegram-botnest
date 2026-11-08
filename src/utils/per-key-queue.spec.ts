import { PerKeyQueue } from './per-key-queue';

const tick = () => new Promise((r) => setImmediate(r));

describe('PerKeyQueue', () => {
  it('один ключ — по очереди: вторая задача стартует после первой', async () => {
    const q = new PerKeyQueue();
    const log: string[] = [];
    const job = (name: string) => async () => {
      log.push(`${name}:start`);
      await tick();
      log.push(`${name}:end`);
    };
    await Promise.all([q.run('1', job('a')), q.run('1', job('b'))]);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('разные ключи — параллельно', async () => {
    const q = new PerKeyQueue();
    const log: string[] = [];
    const job = (name: string) => async () => {
      log.push(`${name}:start`);
      await tick();
      log.push(`${name}:end`);
    };
    await Promise.all([q.run('1', job('a')), q.run('2', job('b'))]);
    expect(log.slice(0, 2)).toEqual(['a:start', 'b:start']);
  });

  it('сбой задачи доходит до её вызывающего, но не отменяет следующую', async () => {
    const q = new PerKeyQueue();
    const failed = q.run('1', () => Promise.reject(new Error('boom')));
    const next = q.run('1', () => Promise.resolve('ok'));
    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('отработавший ключ не остаётся в карте', async () => {
    const q = new PerKeyQueue();
    await q.run('1', () => Promise.resolve());
    await tick();
    expect(q.busyKeys).toBe(0);
  });
});
