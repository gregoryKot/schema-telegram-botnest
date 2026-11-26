// Строка «повтор помог» в блоке «Поломки на клиенте» /stats (правило №8).
// Чистый форматтер, тест с пустой БД. Инцидент 2026-11-04 (#928): неудачу
// повтора видно строкой «Файлы сайта не загрузились», а сработавший повтор
// webapp/public/asset-recovery.js не считал никто — сколько выкладок задело
// людей без последствий, было не видно. Событие — asset_recovered
// (src/analytics/asset-recovery.constants.ts).
import { plural } from './plural';

export interface AssetRecoveryMetrics {
  /** За неделю: стиль догрузился новым <link>. */
  cssWeek: number;
  /** За неделю: входной модуль загрузился после перезагрузки. */
  jsWeek: number;
}

const times = (n: number) => `${n} ${plural(n, 'раз', 'раза', 'раз')}`;

/** Одна строка для блока «Поломки на клиенте». Чистая функция. */
export function formatAssetRecovery(m: AssetRecoveryMetrics): string {
  if (m.cssWeek + m.jsWeek === 0) {
    return 'Догружать файлы сайта повтором за неделю не понадобилось.';
  }
  const parts: string[] = [];
  if (m.cssWeek > 0) parts.push(`стиль — ${times(m.cssWeek)}`);
  if (m.jsWeek > 0) {
    parts.push(`приложение после перезагрузки — ${times(m.jsWeek)}`);
  }
  return `Файлы сайта не дошли с первого раза, но повтор помог: ${parts.join(', ')} за неделю.`;
}
