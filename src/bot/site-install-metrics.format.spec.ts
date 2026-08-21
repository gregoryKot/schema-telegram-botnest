// Форматтер блока «Установка с сайта» в /stats: пустая БД (без NaN и без
// пустых строк), полные данные (обе механики), частичные данные (только
// баннер / только лендинг — вторая строка не печатается).
import {
  formatSiteInstallMetrics,
  SiteInstallMetrics,
} from './site-install-metrics.format';

const EMPTY: SiteInstallMetrics = {
  banner: { shown30: 0, add30: 0, added30: 0 },
  landing: { add30: 0, added30: 0 },
};

const FULL: SiteInstallMetrics = {
  banner: { shown30: 40, add30: 18, added30: 12 },
  landing: { add30: 25, added30: 9 },
};

describe('formatSiteInstallMetrics', () => {
  it('пустая БД: ровно одна строка, без NaN и undefined', () => {
    const text = formatSiteInstallMetrics(EMPTY);
    expect(text).toBe(
      '📲 <b>Установка с сайта</b>: за 30 дней никто не ставил.',
    );
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('полные данные: и баннер кабинета, и лендинг', () => {
    const text = formatSiteInstallMetrics(FULL);
    expect(text).toContain('📲 <b>Установка с сайта</b> (за месяц)');
    expect(text).toContain(
      'Баннер в кабинете: развернули инструкцию 40 · нажали установить 18 · поставили 12',
    );
    expect(text).toContain('Лендинг: нажали установить 25 · поставили 9');
  });

  it('только лендинг — строка баннера не печатается', () => {
    const text = formatSiteInstallMetrics({
      banner: { shown30: 0, add30: 0, added30: 0 },
      landing: { add30: 5, added30: 2 },
    });
    expect(text).not.toContain('Баннер в кабинете');
    expect(text).toContain('Лендинг: нажали установить 5 · поставили 2');
  });

  it('только баннер — строка лендинга не печатается', () => {
    const text = formatSiteInstallMetrics({
      banner: { shown30: 7, add30: 3, added30: 1 },
      landing: { add30: 0, added30: 0 },
    });
    expect(text).toContain(
      'Баннер в кабинете: развернули инструкцию 7 · нажали установить 3 · поставили 1',
    );
    expect(text).not.toContain('Лендинг');
  });

  // Язык отчёта — простой, без англицизмов/внутренних имён (правило №8).
  it('в тексте нет служебных ключей', () => {
    const text = formatSiteInstallMetrics(FULL);
    expect(text).not.toMatch(/site_banner|site_landing|home_screen_offer/);
  });
});
