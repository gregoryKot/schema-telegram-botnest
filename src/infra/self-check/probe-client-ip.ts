import { clientIpSummary, type IpSampleSummary } from '../client-ip-sample';
import { Probe } from './types';

/** Меньше записей — вывод преждевременен (проба бежит через минуту после деплоя). */
export const MIN_SAMPLES = 50;
/** Доля запросов, у которых адрес посетителя не дошёл. */
export const UNRESOLVED_LIMIT = 0.9;
/** Доля запросов с метками CDN. */
export const CDN_LIMIT = 0.5;

const pct = (part: number, total: number) => Math.round((part / total) * 100);

/**
 * Настоящий адрес посетителя за прокси (трекер: аудит 2026-10, trust proxy).
 * Смотрит живой трафик, а не делает свой запрос: см. client-ip-sample.ts.
 * Красная проба значит, что IP-бакеты троттлинга (правило №5), адреса в
 * WebSession и аудит-логах схлопнулись в адрес прокси или CDN.
 */
export function clientIpProbe(
  summary: () => IpSampleSummary = clientIpSummary,
): Probe {
  return {
    id: 'clientIp',
    title: 'Реальный адрес посетителя за прокси',
    critical: false,
    run() {
      const { total, unresolved, cdnMarked } = summary();
      if (total < MIN_SAMPLES) {
        return Promise.resolve({
          ok: true,
          detail: `запросов через прокси мало (${total} из ${MIN_SAMPLES}), проверять рано`,
        });
      }
      const problems: string[] = [];
      if (unresolved / total >= UNRESOLVED_LIMIT) {
        problems.push(
          `адрес посетителя не доходит (${pct(unresolved, total)}% из ${total} запросов): все лимиты и журналы видят адрес прокси, проверить trust proxy и прокси перед приложением`,
        );
      }
      if (cdnMarked / total >= CDN_LIMIT) {
        problems.push(
          `перед прокси появился CDN (${pct(cdnMarked, total)}% из ${total} запросов с его метками): лимиты по IP схлопнулись в адреса CDN, нужны trusted_proxies в Caddy и trust proxy = 2`,
        );
      }
      return Promise.resolve(
        problems.length
          ? { ok: false, detail: problems.join('; ') }
          : {
              ok: true,
              detail: `адрес посетителя доходит: ${total - unresolved} из ${total} недавних запросов с публичным адресом`,
            },
      );
    },
  };
}
