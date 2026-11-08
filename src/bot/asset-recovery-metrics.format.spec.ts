// Строка «повтор помог» в «Поломках на клиенте» (инцидент 2026-11-04, #928):
// пустая БД словами, виды повтора без внутренних id.
import { formatAssetRecovery } from './asset-recovery-metrics.format';

describe('formatAssetRecovery', () => {
  it('пустая БД — одна строка словами, без нулей и NaN', () => {
    const text = formatAssetRecovery({ cssWeek: 0, jsWeek: 0 });
    expect(text).toBe(
      'Догружать файлы сайта повтором за неделю не понадобилось.',
    );
    expect(text).not.toMatch(/NaN|undefined|\b0\b/);
  });

  it('оба вида: стиль и приложение после перезагрузки, с правильными формами', () => {
    expect(formatAssetRecovery({ cssWeek: 3, jsWeek: 1 })).toBe(
      'Файлы сайта не дошли с первого раза, но повтор помог: стиль — 3 раза, ' +
        'приложение после перезагрузки — 1 раз за неделю.',
    );
  });

  it('только один вид — второго в строке нет', () => {
    const text = formatAssetRecovery({ cssWeek: 0, jsWeek: 5 });
    expect(text).toContain('приложение после перезагрузки — 5 раз');
    expect(text).not.toContain('стиль');
    expect(text).not.toMatch(/css|js\b|asset/i);
  });
});
