// Блок «Вход в мессенджере» для /stats (правило №8): чистый форматтер, тест
// покрывает все ветки, включая пустую БД. Зачем: 2026-08-08 вход был сломан у
// ВСЕХ пользователей Telegram, а узнали об этом от человека.
//
// Почему обмен подписи, а не guard (находка 2026-11-08): сайт в мессенджере
// ходит с Bearer и меняет подпись на сессию в ручках обмена; прежняя пара
// считала путь мини-аппа в guard'е. Что считается — auth-health-rows.ts.
import { plural } from './plural';
import type {
  AuthHealthMetrics,
  ExchangeCounts,
  Window,
} from './auth-health-rows';

const HOSTS = [
  ['telegram', 'Telegram'],
  ['max', 'MAX'],
] as const;
const TEXT = {
  empty: 'За неделю входов из мессенджера не было — сравнивать пока не с чем.',
  expired:
    '«Устарела» — окно мессенджера висело открытым дольше часа, и пропуск входа истёк.',
  suspicious:
    '«Не сошлась» — пропуск входа не прошёл проверку: подделка или сменился ключ бота.',
  now: 'Это происходит прямо сейчас — открой приложение в мессенджере и проверь вход.',
  fixed: 'За сутки сбоев не было — похоже, уже починено.',
} as const;
const fails = (c: ExchangeCounts, w: Window) => c.expired[w] + c.suspicious[w];
const times = (n: number) => `${n} ${plural(n, 'раз', 'раза', 'раз')}`;

/** «вошли N, не смогли M (устарела X, не сошлась Y)» — причины без нулей. */
function pair(c: ExchangeCounts, w: Window): string {
  const why = [
    c.expired[w] > 0 ? `устарела ${c.expired[w]}` : '',
    c.suspicious[w] > 0 ? `не сошлась ${c.suspicious[w]}` : '',
  ].filter(Boolean);
  const tail = why.length ? ` (${why.join(', ')})` : '';
  return `вошли ${c.ok[w]}, не смогли ${fails(c, w)}${tail}`;
}

function failureLines(m: AuthHealthMetrics, ok: number, fail: number) {
  const out = ['Не все смогли войти из мессенджера:'];
  const hosts = HOSTS.map(([k, title]) => [m.hosts[k], title] as const);
  for (const [c, title] of hosts) {
    if (c.ok.week + fails(c, 'week') === 0) continue;
    const day = pair(c, 'day');
    out.push(`${title} за неделю: ${pair(c, 'week')}; за сутки: ${day}`);
  }
  const pct = Math.round((ok / (ok + fail)) * 100);
  out.push(`Успешных входов за неделю: ${ok} из ${ok + fail} (${pct}%).`);
  for (const k of ['expired', 'suspicious'] as const)
    if (hosts.some(([c]) => c[k].week > 0)) out.push(TEXT[k]);
  out.push(hosts.some(([c]) => fails(c, 'day') > 0) ? TEXT.now : TEXT.fixed);
  return out;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatAuthHealth(m: AuthHealthMetrics): string {
  const lines = ['🔑 <b>Вход в мессенджере</b>'];
  const sum = (f: (c: ExchangeCounts) => number) =>
    HOSTS.reduce((s, [k]) => s + f(m.hosts[k]), 0);
  const ok = sum((c) => c.ok.week);
  const fail = sum((c) => fails(c, 'week'));
  if (ok + fail === 0) lines.push(TEXT.empty);
  else if (fail === 0)
    lines.push(`За неделю вошли из мессенджера ${times(ok)}, сбоев не было.`);
  else lines.push(...failureLines(m, ok, fail));
  const legacy = m.legacyEmptyWeek;
  if (legacy > 0)
    lines.push(
      `Без пропуска входа пришли старые окна: ${times(legacy)} за неделю. Их открыли ` +
        'до того, как убрали мини-приложение, — со временем таких не останется.',
    );
  return lines.join('\n');
}
