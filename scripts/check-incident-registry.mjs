#!/usr/bin/env node
// Гейт реестра инцидентов (правило №20, аудит 2026-10 «Документация и процесс»).
//
// Тревога CI (issue `ci-alarm` от джобы `alarm` в nightly.yml и prod-smoke.yml),
// которая продержалась больше одного прогона, — это поломка, а не мигание:
// бот дописал в issue напоминание («Всё ещё красный…» у смока, «Упали
// джобы: …» у ночной проверки). Такая закрытая issue обязана получить строку в
// `docs/INCIDENTS.md`: в строке есть `#<номер issue>`, а дата строки попадает в
// окно issue (создана → закрыта, ±1 день — строку датируют поломкой, а issue
// открывается при следующем прогоне). До гейта реестр отставал на месяц: пять
// поломок октября чинились как инциденты, а строк не получили.
//
// Issue без напоминания (красный один прогон, следующий зелёный) — вспышка,
// строки не требует. Исключение — запись в
// `scripts/incident-registry-baseline.json` `{ "<номер>": { "reason": "…" } }`:
// разобрано, инцидента нет, или честный долг «не разобрано». Без `--update`:
// это решение человека, а не счётчик. Протухшая запись (issue уже со строкой,
// без напоминания или не найдена среди закрытых) — тоже красное.
//
// Гейт ходит в сеть (класс 15 реестра): GitHub без ответа с трёх попыток
// (таймаут 15 с, сеть, не-2xx) — код 2 и отдельный текст, а не «нарушение». В песочнице теста сеть не нужна:
// `--issues=<файл> --comments=<файл>` — записанные ответы GitHub
// (test/fixtures/recorded/github-ci-alarm-*.json).
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'incident-registry-baseline.json');
const INCIDENTS_PATH = join(ROOT, 'docs', 'INCIDENTS.md');
const REPO = process.env.GITHUB_REPOSITORY || 'gregoryKot/schema-telegram-botnest';
const BOT = 'github-actions[bot]';
const REMINDER_RE = /^(Всё ещё красный|Упали джобы)/;
const DAY = 86_400_000;
const REASON_RED_FLAGS = ['legacy', 'todo', 'потом', 'позже'];

const dayMs = (iso) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/** Интервал даты строки реестра: «2026-10-04», «… → 15», «… → 10-15»,
 * «… → 2026-11-07», «… (открыт)» — открытый конец. */
export function parseRowDates(cell) {
  const m = /^(\d{4})-(\d{2})-(\d{2})\??(?:\s*→\s*(?:(\d{4})-)?(?:(\d{2})-)?(\d{2}))?/.exec(cell.trim());
  if (!m) return null;
  const [, y, mo, d, y2, mo2, d2] = m;
  const from = Date.UTC(+y, +mo - 1, +d);
  let to = d2 ? Date.UTC(+(y2 ?? y), +(mo2 ?? mo) - 1, +d2) : from;
  if (/\(открыт\)/.test(cell)) to = Infinity;
  return { from, to };
}

export function parseRows(markdown) {
  return markdown
    .split('\n')
    .filter((l) => /^\| \d{4}-\d{2}-\d{2}/.test(l))
    .map((l) => ({
      dates: parseRowDates(l.split('|')[1]),
      refs: new Set([...l.matchAll(/#(\d+)(?!\d)/g)].map((x) => Number(x[1]))),
    }));
}

/** Issue → { number, from, to, reminders }; PR и открытые отброшены. */
export function closedAlarms(issues, comments) {
  const reminders = new Map();
  for (const c of comments) {
    if (c.user?.login !== BOT || !REMINDER_RE.test(c.body ?? '')) continue;
    const n = Number(String(c.issue_url).split('/').pop());
    reminders.set(n, (reminders.get(n) ?? 0) + 1);
  }
  return issues
    .filter((i) => !i.pull_request && i.state === 'closed' && i.closed_at)
    .map((i) => ({
      number: i.number,
      from: dayMs(i.created_at),
      to: dayMs(i.closed_at),
      window: `${i.created_at.slice(0, 10)} → ${i.closed_at.slice(0, 10)}`,
      reminders: reminders.get(i.number) ?? 0,
    }));
}

export function verdict(alarms, rows, baseline) {
  const problems = [];
  const byNumber = new Map(alarms.map((a) => [a.number, a]));
  const covered = (a) =>
    rows.some((r) => r.refs.has(a.number) && r.dates && r.dates.from <= a.to + DAY && r.dates.to >= a.from - DAY);
  for (const a of alarms) {
    if (a.reminders === 0 || covered(a) || String(a.number) in baseline) continue;
    const off = rows.some((r) => r.refs.has(a.number));
    problems.push(
      `#${a.number} (${a.window}, напоминаний ${a.reminders}): ` +
        (off ? 'строка с этим номером есть, но её дата вне окна issue' : 'нет строки в docs/INCIDENTS.md'),
    );
  }
  for (const [key, entry] of Object.entries(baseline)) {
    const a = byNumber.get(Number(key));
    if (!a) problems.push(`бейслайн #${key}: issue не найдена среди закрытых ci-alarm — запись протухла`);
    else if (a.reminders === 0) problems.push(`бейслайн #${key}: у issue нет напоминаний — исключение не нужно`);
    else if (covered(a)) problems.push(`бейслайн #${key}: строка в реестре уже есть — убери запись`);
    const reason = String(entry?.reason ?? '').trim();
    const flag = REASON_RED_FLAGS.find((w) => reason.toLowerCase().includes(w));
    if (reason.length < 20) problems.push(`бейслайн #${key}: причина короче 20 символов`);
    else if (flag) problems.push(`бейслайн #${key}: причина похожа на отписку («${flag}»)`);
  }
  return problems;
}

async function getJson(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'check-incident-registry' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let last;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, { headers, signal: AbortSignal.timeout(15_000) });
      if (res.ok) return await res.json();
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
  throw new Error(`GitHub API без ответа на ${path}: ${last}`);
}

async function fetchFromGitHub() {
  const issues = [];
  for (let page = 1; page <= 50; page += 1) {
    const batch = await getJson(`issues?labels=ci-alarm&state=closed&per_page=100&page=${page}`);
    issues.push(...batch);
    if (batch.length < 100) break;
  }
  const comments = [];
  // Напоминание — второй комментарий и дальше: у issue с одним (закрывающим) его нет.
  for (const i of issues.filter((x) => x.comments >= 2)) {
    comments.push(...(await getJson(`issues/${i.number}/comments?per_page=100`)));
  }
  return { issues, comments };
}

function readArg(name) {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? JSON.parse(readFileSync(resolve(a.slice(name.length + 3)), 'utf8')) : null;
}

async function main() {
  let data;
  const issues = readArg('issues');
  if (issues) data = { issues, comments: readArg('comments') ?? [] };
  else {
    try {
      data = await fetchFromGitHub();
    } catch (e) {
      console.error(`⚠ ${e.message}\nЭто не нарушение реестра: данных GitHub нет. Перезапусти джобу.`);
      process.exit(2);
    }
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const alarms = closedAlarms(data.issues, data.comments);
  const problems = verdict(alarms, parseRows(readFileSync(INCIDENTS_PATH, 'utf8')), baseline);
  if (problems.length) {
    console.error('❌ Реестр инцидентов (правило №20): закрытая тревога CI с напоминанием без строки\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nДопиши строку в docs/INCIDENTS.md (симптом, корень, класс, кто заметил, сколько жило,\n' +
        'что держит) с номером issue и датой в её окне. Инцидента нет (вспышка сети, сломан\n' +
        'тест, а не прод) — запись в scripts/incident-registry-baseline.json с честной причиной.',
    );
    process.exit(1);
  }
  const need = alarms.filter((a) => a.reminders > 0).length;
  console.log(`✓ реестр инцидентов: закрытых тревог ${alarms.length}, с напоминанием ${need} — у всех строка или причина.`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) await main();
