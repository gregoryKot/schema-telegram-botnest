// Вычистка секретов из данных аудит-события перед логом и DM админу.
//
// Аудит 2026-07-20, L6 (docs/SECOND_AUDIT.md). Упреждающее закрытие класса,
// не инцидент: сегодня ни один вызывающий секрета не передаёт (проверяется
// сверкой с call sites в security-log-redact.spec.ts).
//
// Было — чёрный список подстрок: ключ вычищался, если содержал `token`,
// `password`, `secret`, либо был точно `initdata`. Класс, который так НЕ
// ловится: секрет под любым другим именем — `code` и `state` (OAuth),
// `verifier` (PKCE), `sig`/`hash`/`signature` (подпись initData),
// `assertion` (SAML/JWT-bearer), `otp`, `cookie`. Чёрный список молчит о
// том, чего не знает: он ищет признак, а признак у следующего секрета
// будет новый (тот же класс, что реестр кронов, слепой к `Subscription`, —
// правило №17 CLAUDE.md).
//
// Стало — белый список: логируется ТОЛЬКО то, что здесь названо, всё
// остальное `[redacted]`. Незнакомое имя теперь не проходит насквозь, а
// глушится, то есть новый секрет закрыт по умолчанию, ещё до того как
// кто-то про него вспомнит. Цена — поле, забытое в списке, пропадает из
// лога; поэтому сверка с call sites в спеке краснеет на незарегистрированном
// ключе И на протухшей записи, которую больше никто не передаёт.
//
// Цена попавшего в лог секрета здесь двойная: `.error()` этого проекта идёт
// через AlertLogger — не только в stdout, но и в DM владельцу. Живую утечку
// этого класса уже чинили (PR #127: `location.href` с подписанной initData и
// JWT уезжал в логи и в личку).

/**
 * Поля, разрешённые к выводу в аудит-лог и в DM админу.
 *
 * Не «безобидные вообще», а «безобидные настолько, насколько уже допущено
 * остальным аудит-следом»: userId/ip/telegramId — это и есть предмет записи,
 * без них событие бесполезно.
 *
 * Добавляешь поле на call site — добавляй строку сюда в том же PR, иначе
 * спек покажет, что значение уехало в `[redacted]`. Секрет (подпись, код,
 * токен, verifier) в аудит-событие не кладётся вообще: для него есть
 * производные — `reason`, `hash`-свободный `host`, счётчики.
 */
export const LOGGABLE_FIELDS: ReadonlySet<string> = new Set([
  // ─── Кто: владельцы и участники события ───────────────────────────────
  'userId',
  'telegramId',
  'target', // merge: куда переносим
  'source', // merge: откуда
  'targetId',
  'sourceId',
  'shownTo', // билет входа: кому показали карточку
  'actor', // билет входа: кто нажал
  'adminId',
  'requestId',
  'family', // id семьи refresh-токенов (не токен: по нему нечего предъявить)

  // ─── Откуда: контекст запроса ─────────────────────────────────────────
  'ip',
  'ua', // user-agent, уже обрезанный на call site
  'host', // площадка мини-аппа (telegram/max)
  'endpoint',
  'path', // уже без query: req.path, не req.url
  'route',
  'provider', // google/telegram/vk — имя площадки, не креденшел

  // ─── Что именно: классификация события ────────────────────────────────
  'event',
  'reason',
  'role',
  'intent',
  'step',
  'hint', // статическая подсказка автора кода, не данные пользователя

  // ─── Счётчики и флаги ─────────────────────────────────────────────────
  'suppressed',
  'suppressedSinceLastAlert',
  'sourceLive',
  'targetLive',

  // ─── Свободный текст — осознанно, обрезанный на call site ─────────────
  // `summary` — квалификация из заявки терапевта: админу она и так уходит
  // plaintext'ом отдельным письмом (therapist-request.service.ts), прятать
  // её в аудит-следе того же события смысла нет.
  'summary',
  // `detail` — готовый человеческий текст про конфликт подписок при merge
  // (деньги, разбирается руками): без него DM не на что смотреть.
  'detail',
]);

/** Глубина, дальше которой вложенное значение не разбирается, а глушится. */
const MAX_DEPTH = 3;

const REDACTED = '[redacted]';

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v) as object | null;
  return proto === Object.prototype || proto === null;
};

/** JSON.stringify бросает на bigint — приводим к строке, как было. */
const plainValue = (v: unknown, depth: number): unknown => {
  if (typeof v === 'bigint') return v.toString();
  if (depth >= MAX_DEPTH)
    return isPlainObject(v) || Array.isArray(v) ? REDACTED : v;
  if (Array.isArray(v)) return v.map((item) => plainValue(item, depth + 1));
  // Белый список действует на ЛЮБОЙ глубине: секрет, вложенный в разрешённое
  // поле (`detail: { hash: … }`), — тот же класс, что секрет под чужим именем.
  if (isPlainObject(v)) return redactAt(v, depth + 1);
  return v;
};

const redactAt = (
  data: Record<string, unknown>,
  depth: number,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = LOGGABLE_FIELDS.has(k) ? plainValue(v, depth) : REDACTED;
  }
  return out;
};

/** Данные аудит-события, пригодные к выводу в лог и в DM админу. */
export function redactSecurityLogData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  return redactAt(data, 0);
}
