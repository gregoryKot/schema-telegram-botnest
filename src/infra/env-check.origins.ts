import type { CrossCheck } from './env-check';

// Кросс-проверки CORS (вынесены из env-check.ts: файл упирался в потолок
// размера, правило №10).
export const ORIGIN_CROSS_CHECKS: CrossCheck[] = [
  {
    // F-2 (аудит 2026-10): визитка практики (kotlarewski.*) ходит в API
    // same-origin и отдаёт только себя (правило №19) — CORS-origin с
    // credentials для неё не нужен. Остаток в ALLOWED_ORIGINS — ослабление
    // CORS без причины: чужая страница на этом хосте получила бы запросы
    // с куками посетителя.
    id: 'allowedOriginsNoAliasHosts',
    check: (env) => {
      const aliases = (env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter((o) => /kotlarewski\./i.test(o));
      return aliases.length === 0
        ? null
        : `ALLOWED_ORIGINS содержит ${aliases.join(', ')} — визитка ходит в API ` +
            'same-origin, CORS-origin для неё остаток F-2 и в списке не нужен';
    },
  },
];
