// Блок «Баннеры-переходы» для /stats (правило №8: событие без строки в
// отчёте — невидимо). web_banner_open/web_banner_dismiss были в allow-list
// аналитики, но не в /stats — этот файл закрывает пробел. Чистый
// форматтер, покрыт тестом, включая пустую БД.

export interface WebBannerMetrics {
  /** За месяц: сколько раз нажали каждый баннер (meta.banner), по убыванию. */
  opens30: Array<{ banner: string; count: number }>;
  /** За месяц: сколько раз каждый баннер скрыли, по убыванию. */
  dismisses30: Array<{ banner: string; count: number }>;
}

// Человеческие подписи баннеров — в отчёте не должно быть внутренних id.
// Сверка с реестром — в спеке форматтера (новый баннер без подписи вылезет
// в отчёт голым ключом).
export const WEB_BANNER_LABELS: Record<string, string> = {
  cabinet_full: 'Кабинет: полная версия на сайте',
  mode_map: 'Карта режимов на сайте',
  mobile_app: 'Сайт: открыть приложение',
};

const label = (banner: string): string => WEB_BANNER_LABELS[banner] ?? banner;

const listByLabel = (rows: Array<{ banner: string; count: number }>): string =>
  rows.map((r) => `${label(r.banner)} — ${r.count}`).join(' · ');

/** Текстовый блок для /stats. Чистая функция. */
export function formatWebBannerMetrics(m: WebBannerMetrics): string {
  if (m.opens30.length === 0 && m.dismisses30.length === 0) {
    return '🔀 <b>Баннеры-переходы</b>: за 30 дней не нажимали.';
  }
  const lines = [`🔀 <b>Баннеры-переходы</b> (за месяц)`];
  if (m.opens30.length > 0) {
    lines.push(`Переходили: ${listByLabel(m.opens30)}`);
  }
  if (m.dismisses30.length > 0) {
    lines.push(`Скрывали: ${listByLabel(m.dismisses30)}`);
  }
  return lines.join('\n');
}
