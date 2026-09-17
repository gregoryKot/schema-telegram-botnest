#!/usr/bin/env node
// Гейт: деплой-шов (Dockerfile ↔ .dockerignore ↔ src/app.module.ts ↔
// amvera.yml) — правило №14 CLAUDE.md, «всё, что исполняется у пользователя,
// обязано быть кем-то проверено».
//
// Класс: Dockerfile кладёт собранный мини-апп в webapp/dist/app/, а
// src/app.module.ts отдаёт его оттуда через ServeStaticModule — две строки на
// разных языках, обязаны совпадать, и ничто их не связывает: tsc/jest/eslint
// Dockerfile не читают вовсе. Протухший источник COPY или разъехавшееся
// назначение оставляют CI зелёным, а красным станет билд на Amvera — ПОСЛЕ
// мержа, перед живыми пользователями.
//
// Почему статический гейт, а не `docker build`: дефект здесь — рассогласование
// ПУТЕЙ, оно читается с диска за миллисекунды. Настоящий билд стоит минуты и
// требует демона (джоба `checks` его не поднимает), а ловит другой класс —
// синтаксис, сеть до реестра, версии пакетов. Что проверяется — см. секции
// (a)–(d) ниже по файлу.
//   node scripts/check-deploy-paths.mjs [--verbose]
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { dirname, basename, join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const VERBOSE = process.argv.includes('--verbose');
const DOCKERFILE = join(ROOT, 'Dockerfile');
const DOCKERIGNORE = join(ROOT, '.dockerignore');
const APP_MODULE = join(ROOT, 'src', 'app.module.ts');
const AMVERA_YML = join(ROOT, 'amvera.yml');
const ENTRYPOINT = join(ROOT, 'deploy', 'entrypoint.mjs');

// Этих путей нет в git-дереве — их производит сама сборка ДО копирования.
// Явный список вместо молчаливого пропуска: неизвестный промах обязан упасть.
const BUILD_PRODUCED = [
  { path: 'node_modules', why: '`npm ci` ставит зависимости внутри build-стадии' },
  { path: 'dist', why: '`npm run build` бэкенда — компилируется в build-стадии' },
  { path: 'webapp/dist', why: '`npm run build --prefix webapp` — билдится в Dockerfile' },
  { path: 'game/dist', why: '`npm run build --prefix game` — билдится в Dockerfile' },
];
const buildProducedEntry = (p) => BUILD_PRODUCED.find(({ path: bp }) => p === bp || p.startsWith(`${bp}/`));
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// Склеивает `\`-продолжения Dockerfile-строк в одну логическую строку —
// иначе многострочный RUN/COPY читался бы как обрывки.
function logicalLines(text) {
  const out = [];
  let buf = '';
  let startLine = 0;
  text.split('\n').forEach((rawLine, i) => {
    const line = rawLine.replace(/\r$/, '');
    if (buf === '') startLine = i + 1;
    if (/\\\s*$/.test(line)) return void (buf += `${line.replace(/\\\s*$/, '')} `);
    buf += line;
    out.push({ text: buf, line: startLine });
    buf = '';
  });
  if (buf) out.push({ text: buf, line: startLine });
  return out;
}

// `COPY [--flags] src... dst` (контекст). `--from=` — источник это выход
// предыдущей стадии образа, не файл репозитория, пропускаем. `COPY . .`
// (весь контекст) — точечных путей там нет, тоже пропускаем.
function parseCopyLine(raw) {
  const m = raw.match(/^COPY\s+(.*)$/i);
  if (!m) return null;
  const rest = m[1].trim();
  const positional = rest.split(/\s+/).filter((t) => t && !t.startsWith('--'));
  if (/--from=/.test(rest)) {
    // Источник — путь ВНУТРИ предыдущей стадии (`/app/prisma`). Для правила
    // (a) он бесполезен, но нужен правилу (c2): в стадию он попал из контекста.
    if (positional.length < 2) return { skip: true };
    return { skip: true, stageSrc: positional[0] };
  }
  if (positional.length < 2) return null;
  const dst = positional[positional.length - 1];
  const srcs = positional.slice(0, -1);
  if (srcs.length === 1 && srcs[0] === '.' && dst.replace(/\/$/, '') === '.')
    return { skip: true, wholeContext: true };
  return { srcs, dst };
}

// `cp -r src dst` внутри RUN читает файловую систему УЖЕ собираемого образа,
// не build-контекст — .dockerignore на него не влияет (правило (c) не про это).
function parseRunCp(raw) {
  const re = /\bcp\s+-[rR]\s+(\S+)\s+(\S+)/g;
  return [...raw.matchAll(re)].map((m) => ({ src: m[1], dst: m[2] }));
}

const globToRegExp = (pattern) =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

// Существует ли исходный путь COPY/`cp -r`. Понимает `dir/*` (директория
// целиком — проверяем саму директорию) и `name*.ext` (glob по имени файла).
function checkSourceExists(rawSrc) {
  let p = rawSrc.replace(/^\.\//, '').replace(/\/$/, '');
  if (p === '.') return { ok: true, note: 'весь контекст' };
  let isDirGlob = false;
  if (p.endsWith('/*')) {
    p = p.slice(0, -2);
    isDirGlob = true;
  }
  const produced = buildProducedEntry(p);
  if (produced) return { ok: true, note: `производится сборкой: ${produced.why}` };
  // `dir/*` — `p` уже сама директория; проверяем её, а не dirname(p) (это
  // была бы родительская директория).
  if (isDirGlob) {
    const dirAbs = join(ROOT, p);
    const ok = existsSync(dirAbs) && statSync(dirAbs).isDirectory();
    return { ok, note: ok ? 'директория найдена' : `директория «${p}» не найдена` };
  }
  const base = basename(p);
  const dirRel = dirname(p) === '.' ? '' : dirname(p);
  if (!base.includes('*')) {
    const ok = existsSync(join(ROOT, p));
    return { ok, note: ok ? 'найден' : 'не найден в репозитории' };
  }
  const dirAbs = join(ROOT, dirRel);
  if (!existsSync(dirAbs) || !statSync(dirAbs).isDirectory()) {
    return { ok: false, note: `директория «${dirRel || '.'}» не найдена` };
  }
  const re = globToRegExp(base);
  const matched = readdirSync(dirAbs).some((f) => re.test(f));
  return { ok: matched, note: matched ? 'найден по маске' : `ни один файл не совпал с «${base}»` };
}

function readDockerignoreEntries() {
  if (!existsSync(DOCKERIGNORE)) return [];
  return readFileSync(DOCKERIGNORE, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.replace(/\/$/, ''));
}

// Точное совпадение, родительская директория или простая `*`-маска.
function dockerignoreExcludes(entries, srcPath) {
  const norm = srcPath.replace(/^\.\//, '').replace(/\/$/, '');
  for (const entry of entries) {
    if (entry.includes('*')) {
      const re = globToRegExp(entry);
      if (re.test(norm) || re.test(basename(norm))) return entry;
      continue;
    }
    if (entry === norm || norm.startsWith(`${entry}/`)) return entry;
  }
  return null;
}

// Не полноценный YAML-парсер, а прицельное чтение строк (toolchain.name,
// run.containerPort, опциональные command/entrypoint/start/script): формат
// плоский, а YAML-зависимость ради трёх полей — лишний вес для джобы без
// npm ci. Усложнится файл — регексы скажут «не найдено», а не соврут.
function checkAmveraYml() {
  if (!existsSync(AMVERA_YML)) return ['amvera.yml не найден — конфигурация деплоя Amvera отсутствует'];
  const problems = [];
  const text = readFileSync(AMVERA_YML, 'utf8');

  const toolchain = text.match(/toolchain:\s*[\r\n]+\s*name:\s*(\S+)/)?.[1];
  if (toolchain === 'docker' && !existsSync(DOCKERFILE)) {
    problems.push('amvera.yml: toolchain.name=docker, но Dockerfile не найден в корне репозитория — Amvera не сможет собрать образ');
  }

  const declaredPort = text.match(/containerPort:\s*(\d+)/)?.[1];
  if (declaredPort && !existsSync(ENTRYPOINT)) {
    problems.push('amvera.yml называет containerPort, но deploy/entrypoint.mjs (точка входа CMD в Dockerfile) не найден — не с чем сверить');
  } else if (declaredPort) {
    const entryText = readFileSync(ENTRYPOINT, 'utf8');
    const defaultPort = entryText.match(/process\.env\.PORT[\s\S]*?\?\s*Number\(process\.env\.PORT\)\s*:\s*(\d+)/)?.[1];
    if (!defaultPort) {
      problems.push('amvera.yml: не удалось найти дефолтный публичный порт в deploy/entrypoint.mjs для сверки с containerPort');
    } else if (defaultPort !== declaredPort) {
      problems.push(`amvera.yml: run.containerPort=${declaredPort}, но deploy/entrypoint.mjs слушает публичный порт по умолчанию ${defaultPort} — при расхождении Amvera маршрутизирует трафик в порт, который никто не слушает`);
    }
  }

  const cmdRe = /^\s*(?:command|entrypoint|start|script):\s*(.+)$/gim;
  let cm;
  while ((cm = cmdRe.exec(text))) {
    const value = cm[1].trim().replace(/^['"]|['"]$/g, '');
    const rel = value.match(/([.\w/-]+\.(?:mjs|js|cjs|sh))\b/)?.[1]?.replace(/^\.\//, '');
    if (rel && !existsSync(join(ROOT, rel))) {
      problems.push(`amvera.yml называет несуществующий путь «${rel}» (строка «${cm[0].trim()}»)`);
    }
  }
  return problems;
}

// ── (a) Dockerfile: разбор COPY/RUN cp ──────────────────────────────────────
if (!existsSync(DOCKERFILE)) {
  console.error('❌ гейт деплой-путей: Dockerfile не найден в корне репозитория');
  process.exit(1);
}
const dockerfileText = readFileSync(DOCKERFILE, 'utf8');
const copyEntries = [];
const runCpEntries = [];
/** `COPY --from=<стадия> <путь-в-стадии> …` — нужны правилу (c2). */
const stageCopyEntries = [];
/** Есть ли `COPY . .`: только через него контекст попадает в стадию build. */
let hasWholeContextCopy = false;
for (const { text, line } of logicalLines(dockerfileText)) {
  const trimmed = text.trim();
  if (/^COPY\s/i.test(trimmed)) {
    const parsed = parseCopyLine(trimmed);
    if (parsed?.wholeContext) hasWholeContextCopy = true;
    if (parsed?.stageSrc) {
      // `/app/prisma` → `prisma`: путь стадии сводим к пути репозитория.
      const src = parsed.stageSrc.replace(/^\/app\//, '').replace(/\/$/, '');
      if (src && src !== '/app') stageCopyEntries.push({ src, line, raw: trimmed });
    }
    if (parsed && !parsed.skip) copyEntries.push({ ...parsed, line, raw: trimmed });
  } else if (/^RUN\s/i.test(trimmed) && /\bcp\s+-[rR]\s/.test(trimmed)) {
    for (const cp of parseRunCp(trimmed)) runCpEntries.push({ ...cp, line, raw: trimmed });
  }
}

const problems = [];
const checkedSources = []; // для --verbose
for (const entry of copyEntries) {
  for (const src of entry.srcs) {
    const res = checkSourceExists(src);
    checkedSources.push({ kind: 'COPY', src, line: entry.line, ...res });
    if (!res.ok) problems.push(`Dockerfile:${entry.line} — COPY копирует «${src}», ${res.note} («${entry.raw}»)`);
  }
}
for (const entry of runCpEntries) {
  const res = checkSourceExists(entry.src);
  checkedSources.push({ kind: 'RUN cp', src: entry.src, line: entry.line, ...res });
  if (!res.ok) {
    problems.push(`Dockerfile:${entry.line} — \`cp -r\` копирует «${entry.src}», ${res.note} («${entry.raw}»)`);
  }
}

// ── (b) назначение мини-аппа в Dockerfile ⇄ rootPath в app.module.ts ───────
if (!existsSync(APP_MODULE)) {
  problems.push('src/app.module.ts не найден — не с чем сверить назначение мини-аппа');
} else {
  const appModuleText = readFileSync(APP_MODULE, 'utf8');
  const rootPathMatch = appModuleText.match(/ServeStaticModule\.forRoot\(\{[\s\S]*?rootPath:\s*join\(([^)]*)\)/);
  const miniappCp = runCpEntries.find((e) => e.src.replace(/^\.\//, '').startsWith('schema-miniapp/dist'));
  if (!rootPathMatch) {
    problems.push('src/app.module.ts: не нашли `rootPath: join(...)` внутри ServeStaticModule.forRoot — нечего сверить с Dockerfile');
  } else if (!miniappCp) {
    problems.push('Dockerfile: не нашли `cp -r schema-miniapp/dist/* ...` — нечего сверить с src/app.module.ts');
  } else {
    const rootPath = rootPathMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter((s) => s !== '__dirname' && s !== '..' && s !== '')
      .join('/');
    const expectedDest = `${rootPath}/app`;
    const actualDest = miniappCp.dst.replace(/^\.\//, '').replace(/\/$/, '');
    if (actualDest !== expectedDest) {
      const rootLine = lineOf(appModuleText, rootPathMatch.index);
      problems.push(`Dockerfile:${miniappCp.line} копирует мини-апп в «${actualDest}», а src/app.module.ts:${rootLine} отдаёт статику из «${rootPath}» — ожидалось назначение «${expectedDest}». ServeStaticModule не найдёт мини-апп по этому пути.`);
    }
  }
}

// ── (c) .dockerignore не исключает то, что Dockerfile копирует ─────────────
// Прямой путь: `COPY X ./` берёт X из контекста, а его там нет. Транзитный:
// `COPY --from=build /app/X` берёт X из стадии, но в стадию он попал через
// `COPY . .`, то есть тоже из контекста. Транзитный нашёлся доказательством
// краснения — `prisma` приезжает в рантайм ТОЛЬКО через `--from=`, прямого
// COPY у неё нет, и правило по одним лишь прямым копиям оставалось зелёным
// при сломанной сборке. Произведённое сборкой пропускаем: в контексте его и
// не должно быть.
const ignoreEntries = readDockerignoreEntries();
const ignoreSuspects = [
  ...copyEntries.flatMap((e) =>
    e.srcs.map((src) => ({ src, line: e.line, via: 'COPY из контекста' })),
  ),
  ...(hasWholeContextCopy
    ? stageCopyEntries
        .filter((e) => !buildProducedEntry(e.src))
        .map((e) => ({ src: e.src, line: e.line, via: '`COPY . .` → `COPY --from=`' }))
    : []),
];
for (const { src, line, via } of ignoreSuspects) {
  const hit = dockerignoreExcludes(ignoreEntries, src);
  if (hit) {
    problems.push(`.dockerignore исключает «${hit}», но Dockerfile:${line} копирует «${src}» (${via}) — падает только на сборке образа`);
  }
}

// ── (d) amvera.yml ───────────────────────────────────────────────────────
problems.push(...checkAmveraYml());

if (VERBOSE) {
  console.log('Источники COPY/`cp -r` в Dockerfile:');
  for (const c of checkedSources) console.log(`   ${c.ok ? '✓' : '✗'} [${c.kind}] Dockerfile:${c.line} ${c.src} — ${c.note}`);
}

if (problems.length > 0) {
  console.error('❌ гейт деплой-путей (Dockerfile/.dockerignore/app.module.ts/amvera.yml):');
  for (const p of problems) console.error(`   ${p}`);
  console.error('Эти пути читает только Amvera при сборке образа — ни tsc, ни jest, ни eslint их не видят. Рассинхрон покраснеет ПОСЛЕ мержа, в проде, а не в CI.');
  process.exit(1);
}

const summary = `${checkedSources.length} источников COPY/cp, назначение мини-аппа, ${ignoreEntries.length} строк .dockerignore, amvera.yml`;
console.log(`✓ гейт деплой-путей: ${summary} — без рассинхрона.`);
