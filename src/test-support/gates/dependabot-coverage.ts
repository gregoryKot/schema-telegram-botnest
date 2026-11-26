// Правила гейта «Dependabot видит все lock-файлы» (аудит 2026-10, infra#4).
// Чистые функции над текстом .github/dependabot.yml: yaml-парсера в
// зависимостях нет (js-yaml только транзитивный), а нужные места файла плоские
// и однотипные. Прогон по настоящим файлам и контрольные образцы —
// dependabot-coverage.spec.ts.
//
// Чего гейт НЕ видит: схему GitHub. Опечатка в ключе не роняет CI, бот просто
// молчит; ошибки конфигурации видны в Insights → Dependency graph → Dependabot.

export interface UpdateEntry {
  ecosystem: string;
  directories: string[];
  groups: { name: string; updateTypes: string[]; patterns: string[] }[];
  /** Мажорные группы без комментария с причиной строкой выше. */
  uncommentedMajorGroups: string[];
  hasIgnoreWithoutReason: boolean;
}

const unquote = (s: string): string => s.trim().replace(/^['"]|['"]$/g, '');
const flowList = (s: string): string[] =>
  s
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(unquote)
    .filter(Boolean);

/** Разбор записей `updates:` — только то, что нужно гейту. */
export function parseUpdates(text: string): UpdateEntry[] {
  const lines = text.split('\n');
  const entries: UpdateEntry[] = [];
  let cur: UpdateEntry | null = null;
  let inDirs = false;
  let group: UpdateEntry['groups'][number] | null = null;
  lines.forEach((raw, i) => {
    if (/^\s*#/.test(raw) || !raw.trim()) return;
    const line = raw.replace(/\s+#.*$/, '');
    const eco = /^\s*-\s+package-ecosystem:\s*(\S+)/.exec(line);
    if (eco) {
      cur = {
        ecosystem: unquote(eco[1]),
        directories: [],
        groups: [],
        uncommentedMajorGroups: [],
        hasIgnoreWithoutReason: false,
      };
      entries.push(cur);
      inDirs = false;
      group = null;
      return;
    }
    if (!cur) return;
    const dir = /^\s+directory:\s*(\S+)/.exec(line);
    if (dir) cur.directories.push(unquote(dir[1]));
    if (/^\s+directories:\s*$/.test(line)) {
      inDirs = true;
      return;
    }
    if (inDirs) {
      const item = /^\s+-\s+(\S+)\s*$/.exec(line);
      if (item) {
        cur.directories.push(unquote(item[1]));
        return;
      }
      inDirs = false;
    }
    const name = /^ {6}([\w-]+):\s*$/.exec(line);
    if (name) {
      group = { name: name[1], updateTypes: [], patterns: [] };
      cur.groups.push(group);
    }
    const types = /^\s+update-types:\s*(\[.*\])/.exec(line);
    if (types && group) group.updateTypes = flowList(types[1]);
    const pats = /^\s+patterns:\s*(\[.*\])/.exec(line);
    if (pats && group) group.patterns = flowList(pats[1]);
    // Причина — комментарий строкой выше группы или ключа `ignore:`.
    const prev = lines[i - 1] ?? '';
    const reasoned = /^\s*#/.test(prev);
    if (name && !reasoned && /-major$/.test(name[1])) {
      cur.uncommentedMajorGroups.push(name[1]);
    }
    if (/^\s+ignore:\s*$/.test(line) && !reasoned) {
      cur.hasIgnoreWithoutReason = true;
    }
  });
  return entries;
}

/** `shared/package-lock.json` → `/shared`, корневой → `/`. */
export const lockDirectory = (lockPath: string): string => {
  const dir = lockPath.replace(/\/?package-lock\.json$/, '');
  return dir ? `/${dir}` : '/';
};

export interface Coverage {
  missing: string[];
  stale: string[];
}

/** Каталоги lock-файлов против каталогов npm-записей. */
export function npmCoverage(text: string, lockPaths: string[]): Coverage {
  const wanted = new Set(lockPaths.map(lockDirectory));
  const have = new Set(
    parseUpdates(text)
      .filter((e) => e.ecosystem === 'npm')
      .flatMap((e) => e.directories),
  );
  return {
    missing: [...wanted].filter((d) => !have.has(d)).sort(),
    stale: [...have].filter((d) => !wanted.has(d)).sort(),
  };
}

/** Нарушения структуры очередей: группы и причины. */
export function queueViolations(text: string): string[] {
  const bad: string[] = [];
  for (const e of parseUpdates(text)) {
    const where = `${e.ecosystem} ${e.directories.join(',')}`;
    if (
      e.ecosystem === 'npm' &&
      !e.groups.some((g) => g.updateTypes.includes('patch'))
    ) {
      bad.push(`${where}: нет группы, берущей patch (бот плодит PR на пакет)`);
    }
    for (const g of e.groups) {
      if (g.updateTypes.includes('major') && g.patterns.length === 0) {
        bad.push(`${where}: группа «${g.name}» берёт все мажоры без patterns`);
      }
    }
    for (const name of e.uncommentedMajorGroups) {
      bad.push(`${where}: у группы «${name}» нет комментария с причиной`);
    }
    if (e.hasIgnoreWithoutReason) {
      bad.push(`${where}: у ignore нет комментария с причиной`);
    }
  }
  return bad;
}
