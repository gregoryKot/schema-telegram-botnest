// Сверка merge-драйверов для `setup-merge-drivers.mjs --check` (CI, джоба
// `checks`). Вынесена из setup, чтобы тот не рос (правило №10).
//
// Проверяются четыре вещи, и каждая — отдельный способ тихо сломаться:
//   1. у каждого `merge=<имя>` из .gitattributes есть драйвер в setup. Встроенные
//      git `union`/`text`/`binary` — только для НЕ-бейслайнов и на точном пути
//      (union держит обе стороны журнала на дозапись; маска `*.json merge=union`
//      в конце файла перебила бы драйвер бейслайна: git берёт последнюю строку);
//   2. у каждого драйвера есть скрипт на диске;
//   3. у КАЖДОГО `*-baseline.json` (scripts/, e2e-browser/) в .gitattributes
//      есть явная строка с точным путём и объявленным драйвером. Без атрибута
//      git сводит файл текстово: два PR, снизившие счётчик, конфликтуют, а
//      ручное разрешение откатывает чужой прогресс (правило №13). До проверки
//      12 из 37 бейслайнов жили без атрибута, и CI молчал;
//   4. строка .gitattributes про `*-baseline.json`, которого нет на диске,
//      протухла (файл удалён или переименован) — тоже красная.
//
// Catch-all `scripts/*-baseline.json merge=…` запрещён проверкой (3): забытый
// «больше — лучше» бейслайн получил бы min. Списка исключений и `--update` нет.
//
// Предел: сверка читает точные строки путей, а не то, что git выберет для
// файла. `/scripts/x-baseline.json merge=…` прочтётся как протухшая, поздний
// `scripts/*.json -merge` пройдёт, бейслайны вне scripts/ и e2e-browser/ ей не
// видны. Таких случаев нет; появятся — `git check-attr`.
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const BASELINE_DIRS = ['scripts', 'e2e-browser'];
const BASELINE_RE = /-baseline\.json$/;
const BUILTIN_DRIVERS = new Set(['union', 'text', 'binary']); // встроенные в git

/** `.gitattributes` → [{ pattern, driver }] для строк с `merge=`. */
export function parseMergeAttributes(root) {
  const path = join(root, '.gitattributes');
  if (!existsSync(path)) return [];
  const rows = [];
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...attrs] = line.split(/\s+/);
    for (const attr of attrs) {
      const m = attr.match(/^merge=([\w.-]+)$/);
      if (m) rows.push({ pattern, driver: m[1] });
    }
  }
  return rows;
}

/** Бейслайны храповиков на диске (относительные пути с `/`). */
export function listBaselines(root) {
  const out = [];
  for (const dir of BASELINE_DIRS) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (BASELINE_RE.test(f)) out.push(`${dir}/${f}`);
    }
  }
  return out.sort();
}

export function checkMergeDrivers(root, drivers) {
  const problems = [];
  const rows = parseMergeAttributes(root);
  const used = [...new Set(rows.map((r) => r.driver))];

  for (const name of used) {
    if (!drivers[name] && !BUILTIN_DRIVERS.has(name)) {
      problems.push(`.gitattributes ссылается на merge=${name}, но драйвера с таким именем нет в scripts/setup-merge-drivers.mjs — слияние пойдёт текстовым, молча`);
    }
  }
  const wide = rows.filter((r) => BUILTIN_DRIVERS.has(r.driver) && /[*?[]/.test(r.pattern));
  for (const { pattern, driver } of wide) {
    problems.push(`.gitattributes: ${pattern} merge=${driver} — встроенный драйвер только на точном пути файла (маска может накрыть бейслайн)`);
  }
  for (const [driver, { script }] of Object.entries(drivers)) {
    if (!existsSync(join(root, script))) {
      problems.push(`драйвер ${driver} ссылается на несуществующий ${script}`);
    }
  }

  const byPattern = new Map(rows.map((r) => [r.pattern, r.driver]));
  const baselines = listBaselines(root);
  for (const file of baselines) {
    const driver = byPattern.get(file);
    if (driver === undefined) {
      problems.push(
        `${file}: нет строки в .gitattributes — слияние пойдёт текстовым и сконфликтует у двух PR. ` +
          `Добавь «${file}  merge=ratchet-min» (меньше — лучше, реестры со строками-причинами) ` +
          'или merge=ratchet-max (больше — лучше: покрытие, mutation)',
      );
    } else if (!drivers[driver]) {
      problems.push(
        `${file}: merge=${driver} — не драйвер репозитория (встроенные ` +
          'text/union/binary для бейслайнов не годятся: нужна семантика храповика)',
      );
    }
  }
  for (const pattern of byPattern.keys()) {
    if (BASELINE_RE.test(pattern) && !baselines.includes(pattern)) {
      problems.push(
        `.gitattributes: строка про ${pattern}, а файла нет на диске — ` +
          'протухла (удалён или переименован), убери её',
      );
    }
  }
  return { problems, used, baselines: baselines.length };
}
