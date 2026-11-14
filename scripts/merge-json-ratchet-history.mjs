// Поправка sum-слияния для ветки, стоящей на уже влитой squash-ветке.
//
// Ветку B отвели от ветки A, A влили в main squash-коммитом S. Для git S —
// чужой коммит: база слияния B с main осталась точкой до A, и правка A
// приходит с обеих сторон — у нас коммитами A, у них внутри S. Сумма дельт
// считает её дважды (#1123: GameScene 1423 → 1247 в A, → 1094 в B, вышло 918).
//
// Что видно изнутри драйвера: HEAD — наша сторона; их коммит `git merge` и
// `git pull` кладут в окружение `GITHEAD_<sha>` (rebase и cherry-pick — нет,
// там остаётся подсказка). Рабочее дерево ещё до слияния, фактический размер
// файла не узнать — зато доступна история бейслайна. Признак squash: коммит их
// стороны сдвинул бейслайн ровно так же (те же ключи, те же дельты), как наша
// история от базы до нашего коммита X. Значит, бейслайн X уже есть в обеих
// сторонах, и база слияния — он. Совпадение требуется по ВСЕМ ключам коммита:
// случайно оно почти невозможно, а неполное (A дописали после отвода B)
// поправку не включает — остаётся сумма и подсказка с командой пересчёта.
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function git(args) {
  const res = spawnSync('git', args, {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return res.status === 0 ? res.stdout : null;
}

/** Бейслайн в коммите: {} — файла там нет, null — не объект JSON. */
function baselineAt(rev, path) {
  const text = git(['show', `${rev}:${path}`]);
  if (text === null || text.trim() === '') return {};
  try {
    const json = JSON.parse(text);
    return isObj(json) ? json : null;
  } catch {
    return null;
  }
}

/** Листья JSON: путь (массив ключей в JSON-строке) → значение. */
function leaves(node, prefix = [], out = new Map()) {
  for (const [k, v] of Object.entries(node)) {
    if (isObj(v)) leaves(v, [...prefix, k], out);
    else out.set(JSON.stringify([...prefix, k]), v);
  }
  return out;
}

/** Сдвиг от from к to: лист → «Δчисло», «✕» (удалён) или новое значение. */
function changes(from, to) {
  const out = new Map();
  for (const k of new Set([...from.keys(), ...to.keys()])) {
    const [x, y] = [from.get(k), to.get(k)];
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    if (typeof x === 'number' && typeof y === 'number') out.set(k, `Δ${y - x}`);
    else out.set(k, y === undefined ? '✕' : `=${JSON.stringify(y)}`);
  }
  return out;
}

const sameChanges = (p, q) =>
  p.size === q.size && [...p].every(([k, v]) => q.get(k) === v);

/**
 * Наш коммит, чей бейслайн уже влит в их сторону squash-ом: `{ rev, json,
 * squash }`, где json — правильная база вместо %O. null — такого нет или
 * история недоступна (rebase, мелкий клон): драйвер сводит, как раньше.
 */
export function squashedBase(path, ancestor) {
  const heads = Object.keys(process.env).filter((k) =>
    /^GITHEAD_[0-9a-f]{40}([0-9a-f]{24})?$/.test(k),
  );
  if (heads.length !== 1) return null;
  const theirs = heads[0].slice('GITHEAD_'.length);
  const revs = (range, ...flags) => {
    const args = ['rev-list', '--reverse', '--max-count=200', ...flags, range];
    return (git([...args, '--', path]) ?? '').split('\n').filter(Boolean);
  };

  const ours = revs(`${theirs}..HEAD`)
    .map((rev) => ({ rev, json: baselineAt(rev, path) }))
    .filter((x) => x.json)
    .map((x) => ({ ...x, flat: leaves(x.json) }));
  if (!ours.length) return null;

  // Цепочкой: стопка из двух влитых веток даёт два squash-а подряд.
  let base = { rev: null, json: isObj(ancestor) ? ancestor : {} };
  for (const squash of revs(`HEAD..${theirs}`, '--no-merges')) {
    const [before, after] = [
      baselineAt(`${squash}^`, path),
      baselineAt(squash, path),
    ];
    if (!before || !after) continue;
    const delta = changes(leaves(before), leaves(after));
    if (!delta.size) continue;
    const from = leaves(base.json);
    const hit = ours.find((x) => sameChanges(changes(from, x.flat), delta));
    if (hit) base = { rev: hit.rev, json: hit.json, squash };
  }
  return base.rev ? base : null;
}

/** Что драйвер сделал с ключами, сдвинутыми обеими сторонами, и чем сверить. */
export function reportSums(path, summed, squash) {
  const say = (text) => console.error(`merge-json-ratchet (${path}): ${text}`);
  if (squash) {
    say(
      `коммит их стороны ${squash.squash.slice(0, 9)} повторяет нашу историю до ` +
        `${squash.rev.slice(0, 9)} (ветка стояла на влитой squash-ветке) — база ` +
        'слияния взята оттуда, общая правка не задвоена.',
    );
  }
  if (!summed.length) return;
  const name = path.replace(/^.*\//, '').replace(/-baseline\.json$/, '');
  const gate = [
    `scripts/check-${name}.mjs`,
    `scripts/check-${name}-ratchet.mjs`,
  ].find((f) => existsSync(f));
  const rows = summed
    .slice(0, 10)
    .map(
      ({ key, o, a, b, v }) => `  ${key}: база ${o}, наша ${a}, их ${b} → ${v}`,
    );
  if (summed.length > 10) rows.push(`  … и ещё ${summed.length - 10}`);
  say(
    `одни и те же ключи сдвинули обе стороны (${summed.length}) — сведено суммой дельт:\n` +
      `${rows.join('\n')}\n` +
      'Сумма верна для непересекающихся правок. Если ветка стояла на другой, уже ' +
      'влитой ветке, общая правка посчитана дважды — сверь гейтом ' +
      (gate
        ? `\`node ${gate}\`, расходится — \`node ${gate} --update\``
        : 'бейслайна, расходится — его `--update`') +
      '.',
  );
}
