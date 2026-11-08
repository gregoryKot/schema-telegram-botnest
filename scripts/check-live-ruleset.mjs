#!/usr/bin/env node
// Сверка живого ruleset `main` на GitHub с копией .github/rulesets/main.json
// (аудит 2026-10, правило №13). main-ruleset.spec.ts сверяет копию с джобами
// ci.yml, но не с настройкой на GitHub: выключенный ruleset, снятый `strict`,
// новая джоба, которую забыли сделать обязательной, выключенные auto-merge и
// удаление ветки после мержа проходили молча. Ночной шаг (nightly.yml, джоба
// live-ruleset), не PR-гейт: новая джоба законно не обязательна между своим
// мержем и правкой ruleset владельцем.
//
// Что спрашивает (REST GitHub, токен — GITHUB_TOKEN воркфлоу, если задан):
//   /rulesets              — ruleset с именем копии существует, enforcement тот же;
//   /rules/branches/main   — правила, которые GitHub реально применяет к main:
//                            каждое правило копии есть, параметры совпадают,
//                            обязательные проверки — тот же набор, strict;
//   /repos/{repo}          — allow_auto_merge, allow_squash_merge,
//                            delete_branch_on_merge (порядок мержа, №1а и №13).
// Поля настроек слияния GitHub отдаёт не каждому токену; нет поля — красное с
// отдельной причиной, а не молчаливый пропуск (правило №15).
//
//   node scripts/check-live-ruleset.mjs
// GITHUB_API_URL — база API (тест подставляет свой сервер), GITHUB_REPOSITORY —
// репозиторий (по умолчанию gregoryKot/schema-telegram-botnest).
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(import.meta.dirname, '..');
const COPY = join(ROOT, '.github', 'rulesets', 'main.json');

/** Настройки репозитория, без которых не работает порядок мержа агентов. */
export const REPO_SETTINGS = {
  allow_auto_merge: true, // enable_pr_auto_merge (№13)
  allow_squash_merge: true, // мерж — squash (№1а)
  delete_branch_on_merge: true, // смерженная ветка удаляется сама (№13)
};

const contexts = (rule) =>
  (rule?.parameters?.required_status_checks ?? []).map((c) => c.context).sort();

function paramDrift(type, want, got) {
  const out = [];
  for (const [key, value] of Object.entries(want ?? {})) {
    if (key === 'required_status_checks') continue;
    if (JSON.stringify(got?.[key]) !== JSON.stringify(value)) {
      out.push(
        `правило ${type}: ${key} на GitHub ${JSON.stringify(got?.[key])}, в копии ${JSON.stringify(value)}`,
      );
    }
  }
  return out;
}

/** Расхождения живой настройки с копией; пустой список — совпадает. */
export function rulesetDrift({ copy, rulesets, branchRules, repo }) {
  const bad = [];
  const live = rulesets.find((r) => r.name === copy.name);
  if (!live) {
    bad.push(`ruleset «${copy.name}» на GitHub нет`);
  } else if (live.enforcement !== copy.enforcement) {
    bad.push(
      `ruleset «${copy.name}»: enforcement на GitHub ${live.enforcement}, в копии ${copy.enforcement}`,
    );
  }
  const own = branchRules.filter((r) => !live || r.ruleset_id === live.id);
  for (const want of copy.rules ?? []) {
    const got = own.find((r) => r.type === want.type);
    if (!got) {
      bad.push(`правила ${want.type} из копии GitHub к main не применяет`);
      continue;
    }
    bad.push(...paramDrift(want.type, want.parameters, got.parameters));
    if (want.type !== 'required_status_checks') continue;
    const need = contexts(want);
    const have = contexts(got);
    for (const c of need.filter((x) => !have.includes(x))) {
      bad.push(`проверка ${c} обязательна в копии, но не на GitHub`);
    }
    for (const c of have.filter((x) => !need.includes(x))) {
      bad.push(`проверка ${c} обязательна на GitHub, но не в копии`);
    }
  }
  for (const got of own) {
    if (!(copy.rules ?? []).some((r) => r.type === got.type)) {
      bad.push(`на GitHub к main применяется правило ${got.type}, которого нет в копии`);
    }
  }
  for (const [key, value] of Object.entries(REPO_SETTINGS)) {
    if (!(key in repo)) {
      bad.push(
        `API не отдал ${key}: токену не видны настройки слияния репозитория — сверить нельзя`,
      );
    } else if (repo[key] !== value) {
      bad.push(`настройка репозитория ${key} = ${repo[key]}, нужно ${value}`);
    }
  }
  return bad;
}

async function main() {
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  const repoName =
    process.env.GITHUB_REPOSITORY || 'gregoryKot/schema-telegram-botnest';
  const token = process.env.GITHUB_TOKEN;
  const get = async (path) => {
    const res = await fetch(`${api}/repos/${repoName}${path}`, {
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'schemehappens-live-ruleset',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`GET ${path || '/'}: HTTP ${res.status}`);
    return res.json();
  };
  const copy = JSON.parse(readFileSync(COPY, 'utf8'));
  const [rulesets, branchRules, repo] = await Promise.all([
    get('/rulesets'),
    get('/rules/branches/main'),
    get(''),
  ]);
  const bad = rulesetDrift({ copy, rulesets, branchRules, repo });
  if (bad.length === 0) {
    console.log(
      `✓ живой ruleset «${copy.name}» и настройки слияния совпадают с .github/rulesets/main.json`,
    );
    return;
  }
  for (const b of bad) console.error(`::error::live-ruleset: ${b}`);
  console.error(
    'Живая настройка разошлась с копией. Правит владелец (Settings → Rules, Settings → General) ' +
      'или PR в .github/rulesets/main.json — порядок в .claude/rules/gates.md, №13.',
  );
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`::error::live-ruleset: не удалось спросить GitHub — ${e.message}`);
    process.exit(1);
  });
}
