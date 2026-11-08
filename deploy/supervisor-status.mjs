// Состояние супервизора старта (deploy/entrypoint.mjs) для двух читателей:
// front — причина техработ заголовком X-Maintenance-Reason (maintenance-page.mjs),
// и владелец — DM через Bot API, когда супервизор паркуется на техработах.
//
// Аудит 2026-10, «Из entrypoint без поднявшегося приложения сигнала нет»: DM о
// старте и алерты шлёт само приложение, а при упавшем `migrate deploy`, крашлупе
// до `listen` или недоступной базе приложения нет — молчали все каналы, кроме
// смока GitHub (раз в 3–7 часов). Теперь парковка шлёт DM сама, с троттлом по
// той же схеме, что DM о перезапуске (crash-window.mjs): на одну причину — на 1,
// 2, 4, 8… парковке за сутки. Без BOT_TOKEN/ADMIN_ID — молча пропускает.
// Текст — без секретов и адресов: токен живёт только в адресе запроса.
//
// Только встроенные модули Node: супервизор обязан работать при сломанной сборке.
import { shouldNotice } from './crash-window.mjs';

const DAY_MS = 86400000;
const DM_TIMEOUT_MS = 10000;

const PARK_TEXT = {
  'migrate-failed':
    'migrate deploy упал. Приложение не стартует до ручной починки: повтора нет, ' +
    'иначе неидемпотентная миграция задвоит данные. Разбор — с первой ошибки в ' +
    'логах контейнера (RUNBOOKS, «Прод лежит», п. 4).',
  'crashloop-parked':
    'приложение падает при старте, лимит перезапусков исчерпан. После паузы ' +
    '(от 5 минут, растёт до часа) супервизор начнёт новую серию. Причина — в ' +
    'логах node dist/main (RUNBOOKS, «Прод лежит», п. 5).',
  'db-unreachable':
    'база не ответила за отведённое время. Супервизор выждет паузу и проверит ' +
    'базу снова (RUNBOOKS, «Прод лежит», п. 3).',
};

/** Текст DM о k-й за сутки парковке по причине reason. */
export function parkMessage(reason, k) {
  const head = `🛑 Прод на техработах: ${PARK_TEXT[reason] ?? reason}`;
  return k > 1
    ? `${head}\nТаких остановок за сутки: ${k}. Следующее сообщение — когда их станет ${k * 2}.`
    : head;
}

/**
 * Троттл DM о парковке: по каждой причине помнит парковки и сообщения за
 * сутки. Возвращает номер парковки за сутки, если о ней сообщать, иначе 0.
 */
export function createParkThrottle(dayMs = DAY_MS) {
  const parks = new Map();
  const notices = new Map();
  return (reason, now) => {
    const times = [...(parks.get(reason) ?? []), now].filter(
      (t) => now - t < dayMs,
    );
    parks.set(reason, times);
    const seen = (notices.get(reason) ?? []).filter((n) => now - n.at < dayMs);
    const k = times.length;
    const notify = shouldNotice(k, seen, now, dayMs);
    if (notify) seen.push({ at: now, k });
    notices.set(reason, seen);
    return notify ? k : 0;
  };
}

/** DM через Bot API: 'sent' | 'failed'. Не бросает, ждёт не дольше таймаута. */
export async function sendBotDm({ token, chatId, text, apiBase, fetchImpl }) {
  try {
    const res = await fetchImpl(`${apiBase}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(DM_TIMEOUT_MS),
    });
    return res.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Состояние супервизора. cfg: token, chatId (BOT_TOKEN/ADMIN_ID), apiBase,
 * fetchImpl, log, now, dayMs — последние три для тестов.
 */
export function createSupervisorStatus(cfg = {}) {
  const {
    token,
    chatId,
    apiBase = 'https://api.telegram.org',
    fetchImpl = fetch,
    log = console.error,
    now = Date.now,
  } = cfg;
  const throttle = createParkThrottle(cfg.dayMs);
  let reason = 'starting';
  return {
    reason: () => reason,
    set(next) {
      reason = next;
    },
    /** Парковка: причина наружу и DM владельцу. Промис не бросает. */
    async park(next) {
      reason = next;
      if (!token || !chatId) return 'skipped';
      const k = throttle(next, now());
      if (k === 0) return 'throttled';
      const text = parkMessage(next, k);
      const res = await sendBotDm({ token, chatId, text, apiBase, fetchImpl });
      if (res === 'failed') log(`[entrypoint] DM о парковке (${next}) не ушёл`);
      return res;
    },
  };
}
