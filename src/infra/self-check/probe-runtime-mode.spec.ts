import { runtimeModeProbe } from './probe-runtime-mode';

describe('runtimeModeProbe', () => {
  it('прод-образ + production → ok', async () => {
    const r = await runtimeModeProbe(
      { NODE_ENV: 'production' },
      () => true,
    ).run();
    expect(r.ok).toBe(true);
  });

  it.each(['development', 'test', '', undefined])(
    'прод-образ + NODE_ENV=%p → авария без значения в detail',
    async (mode) => {
      const probe = runtimeModeProbe({ NODE_ENV: mode }, () => true);
      const r = await probe.run();
      expect(r.ok).toBe(false);
      expect(r.detail).toMatch(/NODE_ENV не production/);
      if (mode) expect(r.detail).not.toContain(mode);
      expect(probe.critical).toBe(true);
      expect(probe.reportInHealth).not.toBe(false);
    },
  );

  it('локальный запуск без метки сборки → ok при любом NODE_ENV', async () => {
    for (const mode of ['development', 'test', undefined]) {
      const r = await runtimeModeProbe({ NODE_ENV: mode }, () => false).run();
      expect(r.ok).toBe(true);
    }
  });

  it('по умолчанию признак образа берётся из метки сборки (в тестах её нет)', async () => {
    const r = await runtimeModeProbe({ NODE_ENV: 'development' }).run();
    expect(r.ok).toBe(true);
  });
});
