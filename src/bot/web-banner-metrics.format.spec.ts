// Форматтер блока «Баннеры-переходы» в /stats: полные данные, пустая БД (без
// NaN и голых ключей), подписи баннеров без словаря и сверка с реестром
// WEB_BANNER_IDS — новый баннер без подписи вылез бы в отчёт как id.
import {
  formatWebBannerMetrics,
  WEB_BANNER_LABELS,
  WebBannerMetrics,
} from './web-banner-metrics.format';
import { WEB_BANNER_IDS } from '../analytics/analytics.constants';

const FULL: WebBannerMetrics = {
  opens30: [
    { banner: 'mobile_app', count: 25 },
    { banner: 'cabinet_full', count: 10 },
  ],
  dismisses30: [{ banner: 'mode_map', count: 4 }],
};

const EMPTY: WebBannerMetrics = { opens30: [], dismisses30: [] };

describe('formatWebBannerMetrics', () => {
  it('пустая БД: ровно одна строка, без NaN и undefined', () => {
    const text = formatWebBannerMetrics(EMPTY);
    expect(text).toBe('🔀 <b>Баннеры-переходы</b>: за 30 дней не нажимали.');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('полные данные: переходы и скрытия человеческими подписями', () => {
    const text = formatWebBannerMetrics(FULL);
    expect(text).toContain(
      'Переходили: Сайт: открыть приложение — 25 · Кабинет: полная версия на сайте — 10',
    );
    expect(text).toContain('Скрывали: Карта режимов на сайте — 4');
    // Язык отчёта — без внутренних id (правило №8).
    expect(text).not.toMatch(/mobile_app|cabinet_full|mode_map/);
  });

  it('только скрытия без переходов — строка «Переходили» не показывается', () => {
    const text = formatWebBannerMetrics({
      opens30: [],
      dismisses30: [{ banner: 'mode_map', count: 2 }],
    });
    expect(text).not.toContain('Переходили');
    expect(text).toContain('Скрывали: Карта режимов на сайте — 2');
  });

  it('неизвестный id не роняет отчёт — печатается как есть', () => {
    const text = formatWebBannerMetrics({
      opens30: [{ banner: 'новый_баннер', count: 1 }],
      dismisses30: [],
    });
    expect(text).toContain('новый_баннер — 1');
  });

  it('у каждого id из реестра есть человеческая подпись', () => {
    for (const id of WEB_BANNER_IDS) {
      expect(WEB_BANNER_LABELS[id]).toBeTruthy();
    }
  });
});
