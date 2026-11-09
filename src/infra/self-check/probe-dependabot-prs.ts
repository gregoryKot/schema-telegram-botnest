import { Probe } from './types';
import { GITHUB_REPO } from './ci-runs-github';

const PULLS_TIMEOUT_MS = 8_000;
const DAY_MS = 24 * 3_600_000;
/** Бот-PR старше — залежался: агенты доводят их по одной группе (аудит 2026-10). */
export const DEPENDABOT_MAX_AGE_DAYS = 7;
const BOT_LOGIN = 'dependabot[bot]';

interface PullRequest {
  number?: number;
  user?: { login?: string } | null;
  created_at?: string | null;
}

async function fetchOpenPulls(): Promise<PullRequest[]> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/pulls?state=open&per_page=100`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'schemehappens-self-check',
    },
    signal: AbortSignal.timeout(PULLS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GitHub API ответил HTTP ${res.status}`);
  const body = (await res.json()) as unknown;
  return Array.isArray(body) ? (body as PullRequest[]) : [];
}

/**
 * Бот-PR Dependabot красны по построению (бандл, мажоры) и сами не мержатся:
 * их доводит агент по процедуре `docs/open/audit-2026-10.md` («Dependabot:
 * доводка бот-PR»). Без наблюдателя они лежали неделями (Babel 8, #855 и
 * #856: с 2026-10-24 до разбора 2026-11-08). Проба спрашивает
 * публичный REST GitHub (без токена, один запрос) об открытых PR и красна,
 * если у `dependabot[bot]` есть PR старше 7 дней.
 *
 * Сеть, таймаут, лимит API — НЕ красное: это вопрос гигиены репозитория, а
 * не авария прода, и без ответа GitHub сказать нечего. reportInHealth: false —
 * залежавшийся бот-PR не должен красить /health и смок прода (правило №21);
 * владелец видит пробу в DM и /stats.
 */
export function dependabotPrsProbe(): Probe {
  return {
    id: 'dependabotPrs',
    title: 'Бот-PR Dependabot не залёживаются',
    reportInHealth: false,
    async run() {
      let pulls: PullRequest[];
      try {
        pulls = await fetchOpenPulls();
      } catch (e) {
        const msg = (e as Error)?.message?.slice(0, 150) ?? 'сеть недоступна';
        return { ok: true, detail: `GitHub не ответил, не проверено: ${msg}` };
      }
      const now = Date.now();
      const bot = pulls.filter((p) => p.user?.login === BOT_LOGIN);
      const stale = bot
        .map((p) => ({
          number: p.number,
          ageMs: now - Date.parse(p.created_at ?? ''),
        }))
        .filter((p) => p.ageMs >= DEPENDABOT_MAX_AGE_DAYS * DAY_MS)
        .sort((a, b) => b.ageMs - a.ageMs);
      if (stale.length > 0) {
        const list = stale.map(
          (p) => `#${p.number} (${Math.floor(p.ageMs / DAY_MS)} дн.)`,
        );
        return {
          ok: false,
          detail: `бот-PR Dependabot старше ${DEPENDABOT_MAX_AGE_DAYS} дней: ${list.join(', ')} — довести по процедуре docs/open/audit-2026-10.md`,
        };
      }
      return {
        ok: true,
        detail: `открытых бот-PR Dependabot: ${bot.length}, старше ${DEPENDABOT_MAX_AGE_DAYS} дней нет`,
      };
    },
  };
}
