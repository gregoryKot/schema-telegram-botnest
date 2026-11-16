#!/usr/bin/env node
// Реестр обязательных секретов репозитория (аудит 2026-10, «Лежащий прод по-
// прежнему никому не пишет в Telegram»; образец — реестр env, правило №22).
// До гейта отсутствие BOT_TOKEN/ADMIN_ID было видно только по красному
// DM-шагу alarm — то есть только в ночь, когда что-то уже упало.
//
// Список не ведут руками: он собирается статически из всех `secrets.X` в
// .github/workflows/*.yml (кроме системных, SYSTEM_SECRETS_EXEMPT). Так реестр
// не врёт при переименовании (отдельный бот-уведомитель — новое имя — сам
// попадёт в список).
//
// Значение секрета скрипт не видит никогда. Признак «задан» даёт ночной шаг
// (nightly.yml, джоба repo-secrets): `env: HAS_X: ${{ secrets.X != '' }}`.
// Сгенерировать этот список шагом нельзя, поэтому скрипт сверяет строки
// `HAS_X` в nightly.yml со статически собранным списком: воркфлоу сослался
// на новый секрет, а шаг его не проверяет, — красное; лишняя строка — тоже.
//
// Режимы:
//   node scripts/check-repo-secrets.mjs             — только сверка списков
//                                                     (без сети и секретов);
//   node scripts/check-repo-secrets.mjs --presence  — плюс признаки HAS_X из env.
// Незаведённый секрет, который ждёт владельца, — запись в
// scripts/repo-secrets-baseline.json `{ "X": { "reason": "…" } }`: ночь
// зелёная с предупреждением. Новый незаведённый — красный. Запись о заведённом
// секрете или о секрете, на который никто не ссылается, протухла — красное.
// Флага --update нет: заводит секрет владелец, а не счётчик.
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(import.meta.dirname, '..');
const WORKFLOWS = join(ROOT, '.github', 'workflows');
const NIGHTLY = 'nightly.yml';
const BASELINE_PATH = join(ROOT, 'scripts', 'repo-secrets-baseline.json');

// Выдаёт сам GitHub в каждый ран — завести его нельзя и не нужно.
export const SYSTEM_SECRETS_EXEMPT = ['GITHUB_TOKEN'];

const HAS_LINE = /^\s*HAS_(\w+):\s*\$\{\{\s*secrets\.(\w+)\s*!=\s*''\s*\}\}\s*$/;
const REF = /\bsecrets\.([A-Za-z_]\w*)/g;
// Секрет читается только внутри выражения `${{ … }}` — `secrets.mjs` в
// имени файла команды `run:` ссылкой не считается.
const EXPR = /\$\{\{(.*?)\}\}/g;

const code = (text) => text.split('\n').map((l) => (/^\s*#/.test(l) ? '' : l));

/** Статический сбор: { секрет → файлы }, ошибки разбора, строки HAS_. */
export function scanWorkflows(files) {
  const refs = new Map();
  const has = [];
  const bad = [];
  for (const [name, text] of Object.entries(files)) {
    code(text).forEach((line, i) => {
      const where = `${name}:${i + 1}`;
      const h = HAS_LINE.exec(line);
      if (h && name === NIGHTLY) {
        if (h[1] !== h[2]) {
          bad.push(`${where}: HAS_${h[1]} проверяет secrets.${h[2]} — имена обязаны совпадать`);
        }
        has.push(h[2]);
        return;
      }
      const expr = [...line.matchAll(EXPR)].map((e) => e[1]).join(' ');
      if (/\bsecrets\s*\[/.test(expr)) {
        bad.push(`${where}: динамическая ссылка secrets[…] статически не собирается — пиши secrets.ИМЯ`);
      }
      for (const m of expr.matchAll(REF)) {
        if (SYSTEM_SECRETS_EXEMPT.includes(m[1])) continue;
        if (!refs.has(m[1])) refs.set(m[1], new Set());
        refs.get(m[1]).add(name);
      }
    });
  }
  return { refs, has, bad };
}

const sites = (refs, name) => [...refs.get(name)].join(', ');

/** Сверка: `bad` — красное, `warn` — предупреждения. presence: { X: bool } | null. */
export function checkSecrets({ files, baseline, presence }) {
  const { refs, has, bad } = scanWorkflows(files);
  const warn = [];
  for (const name of refs.keys()) {
    if (!has.includes(name)) {
      bad.push(
        `secrets.${name} (${sites(refs, name)}) ночной шаг не проверяет — допиши в env шага джобы repo-secrets ${NIGHTLY}: HAS_${name}: \${{ secrets.${name} != '' }}`,
      );
    }
  }
  for (const name of has) {
    if (!refs.has(name)) {
      bad.push(`HAS_${name} в ${NIGHTLY}: ни один воркфлоу не ссылается на secrets.${name} — убери строку`);
    }
  }
  for (const [name, entry] of Object.entries(baseline)) {
    if (!refs.has(name)) bad.push(`бейслайн: на secrets.${name} никто не ссылается — запись протухла, убери её`);
    if (typeof entry?.reason !== 'string' || !entry.reason.trim()) bad.push(`бейслайн: у ${name} нет причины (reason)`);
  }
  if (!presence) return { bad, warn };
  for (const name of refs.keys()) {
    if (!(name in presence)) {
      bad.push(`--presence: шаг не передал HAS_${name}`);
    } else if (presence[name]) {
      if (baseline[name]) bad.push(`секрет ${name} заведён — убери запись из scripts/repo-secrets-baseline.json`);
    } else if (baseline[name]) {
      warn.push(`секрет ${name} не заведён: ${baseline[name].reason}`);
    } else {
      bad.push(
        `секрет ${name} не заведён (${sites(refs, name)}): заведи его в Settings → Secrets and variables → Actions или запиши в scripts/repo-secrets-baseline.json с причиной`,
      );
    }
  }
  return { bad, warn };
}

/** Признаки из env шага: HAS_X = 'true' | 'false' (значения секрета тут нет). */
export function presenceFromEnv(env) {
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    const m = /^HAS_(\w+)$/.exec(k);
    if (m) out[m[1]] = v === 'true';
  }
  return out;
}

function main() {
  const files = {};
  for (const f of readdirSync(WORKFLOWS).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    files[f] = readFileSync(join(WORKFLOWS, f), 'utf8');
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const presence = process.argv.includes('--presence') ? presenceFromEnv(process.env) : null;
  const { bad, warn } = checkSecrets({ files, baseline, presence });
  for (const w of warn) console.log(`::warning::repo-secrets: ${w}`);
  if (bad.length) {
    for (const b of bad) console.error(`::error::repo-secrets: ${b}`);
    process.exit(1);
  }
  const total = scanWorkflows(files).refs.size;
  const tail = presence ? `; не заведено и ждёт владельца: ${warn.length}` : '';
  console.log(`repo-secrets: секретов в воркфлоу ${total}, ночной шаг проверяет все${tail}`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
