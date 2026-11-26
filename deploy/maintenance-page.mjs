// Страница техработ front (deploy/front-server.mjs) и её причина.
//
// Аудит 2026-10, «Красный смок не говорит, что именно лежит»: страница техработ
// одинакова для окна старта, упавшего `migrate deploy` и крашлупа, и снаружи их
// было не различить — смок видел только «не тот /health». Теперь супервизор
// (deploy/entrypoint.mjs → supervisor-status.mjs) держит текущую причину, а
// front ставит её заголовком X-Maintenance-Reason на страницу техработ; смок
// прода печатает заголовок (prod-smoke.yml). Причина — одно слово-состояние из
// списка ниже, без деталей и секретов: заголовок видит любой клиент.
//
// Только встроенные модули Node: front обязан подниматься при сломанной сборке.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REASON_HEADER = 'X-Maintenance-Reason';

/** Состояния супервизора, которые уходят наружу заголовком. */
export const MAINTENANCE_REASONS = {
  starting: 'контейнер только поднялся',
  'db-wait': 'ждём порт базы',
  migrating: 'recover-p3009 и migrate deploy',
  'app-starting': 'приложение запускается или перезапускается после падения',
  'migrate-failed': 'migrate deploy упал — повтора нет, нужны руки',
  'crashloop-parked': 'лимит перезапусков исчерпан — пауза до новой серии',
  'db-unreachable': 'база не поднялась вовремя — пауза до новой серии',
};

// HTML читаем один раз при старте. Если файл почему-то недоступен — не падаем,
// отдаём минимальный встроенный текст (страница техработ важнее красоты).
export function loadMaintenancePage() {
  try {
    return readFileSync(join(import.meta.dirname, 'maintenance.html'), 'utf8');
  } catch {
    return (
      '<!doctype html><meta charset="utf-8"><title>Технические работы</title>' +
      '<body style="font-family:sans-serif;text-align:center;padding:60px">' +
      '<h1>Небольшие технические работы</h1>' +
      '<p>Приложение скоро снова будет доступно.</p>'
    );
  }
}

/**
 * Сырой HTTP-ответ с заголовком причины: строка вставляется перед концом
 * заголовков. Причины нет или она не из списка — ответ как есть (в заголовок
 * не попадёт ничего, кроме известного слова).
 */
export function withReason(response, reason) {
  if (!Object.hasOwn(MAINTENANCE_REASONS, reason ?? '')) return response;
  const end = response.indexOf('\r\n\r\n');
  if (end === -1) return response;
  return Buffer.concat([
    response.subarray(0, end + 2),
    Buffer.from(`${REASON_HEADER}: ${reason}\r\n`, 'latin1'),
    response.subarray(end + 2),
  ]);
}
