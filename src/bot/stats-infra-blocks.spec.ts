import { infraBlocks } from './stats-infra-blocks';

const selfCheck = (plan?: { legacySourceCount(): Promise<number> }) =>
  infraBlocks(plan).find((b) => b.name === 'Самопроверка')!;

describe('infraBlocks: строка про старые колонки плана', () => {
  it('без счётчика строки нет', async () => {
    expect(await selfCheck().run()).not.toContain('старой записью источника');
  });

  it('счётчик 0 (пустая БД) — колонки можно снимать', async () => {
    const out = await selfCheck({ legacySourceCount: async () => 0 }).run();
    expect(out).toContain('со старой записью источника: 0 — старые колонки');
  });

  it('сбой счёта — строка «посчитать не удалось», остальное на месте', async () => {
    const out = await selfCheck({
      legacySourceCount: () => Promise.reject(new Error('db')),
    }).run();
    expect(out).toContain('источника: посчитать не удалось');
  });
});
