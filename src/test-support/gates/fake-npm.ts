// Поддельный `npm` на PATH для спеков, исполняющих scripts/npm-audit.mjs и
// ночной шаг из nightly.yml (npm-audit.spec.ts, lockfile-audit.spec.ts).
// Отвечает записанными ответами реестра (test/fixtures/recorded/npm-audit-*,
// правило №23), а не сочинённым JSON: формат отчёта и ошибки npm 10 —
// свойство npm, а не обёртки.
//
// Ответ выбирается правилами из env FAKE_NPM: `каталог=ответ,ответ;*=ответ`.
// Ответы по номеру попытки для этого каталога (последний повторяется):
// имя фикстуры (`clean`, `moderate`, `high`, `critical`, `registry-400`),
// `hang` — висит 30 с с дочерним `sleep` (его pid пишется в <log>.pids),
// `garbage` — не-JSON, `empty` — пустой вывод.
import { spawnSync } from 'child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadRecordedFixture } from '../recorded-fixture';

const RESPONSES = ['clean', 'moderate', 'high', 'critical', 'registry-400'];

const SCRIPT = `#!/bin/sh
echo "npm $*" >> "$NPM_LOG"
dir=''; prev=''
for a in "$@"; do [ "$prev" = "--prefix" ] && dir=$a; prev=$a; done
n=$(awk -v d="$dir" '$NF==d' "$NPM_LOG" | wc -l)
rules=$(printf '%s\\n' "$FAKE_NPM" | tr ';' '\\n')
rule=$(printf '%s\\n' "$rules" | awk -F= -v d="$dir" '$1==d{print $2; exit}')
[ -n "$rule" ] || rule=$(printf '%s\\n' "$rules" | awk -F= '$1=="*"{print $2; exit}')
resp=$(printf '%s\\n' "$rule" | awk -F, -v n="$n" '{print (n<=NF)?$n:$NF}')
case "$resp" in
  hang) sleep 30 & echo $! >> "$NPM_LOG.pids"; wait ;;
  garbage) echo 'npm ERR! code ECONNRESET' ;;
  empty) ;;
  *) cat "$FIXTURES/npm-audit-$resp.json" ;;
esac
`;

export interface FakeNpm {
  /** Окружение запуска: PATH с поддельным npm, лог вызовов, фикстуры. */
  env(rules: string, extra?: Record<string, string>): NodeJS.ProcessEnv;
  /** Аргументы каждого вызова npm, по строке: `npm audit …`. */
  calls(): string[];
  /** Живы ли ещё дети висевших попыток (зомби — уже мёртв). */
  aliveChildren(): number[];
  reset(): void;
  cleanup(): void;
}

export function makeFakeNpm(): FakeNpm {
  const bin = mkdtempSync(join(tmpdir(), 'fake-npm-'));
  const log = join(bin, 'npm.log');
  writeFileSync(join(bin, 'npm'), SCRIPT);
  chmodSync(join(bin, 'npm'), 0o755);
  for (const r of RESPONSES) {
    const name = `npm-audit-${r}.json`;
    writeFileSync(join(bin, name), loadRecordedFixture(name));
  }
  const lines = (f: string) =>
    existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean) : [];
  const alive = (pid: number) => {
    const stat = `/proc/${pid}/stat`;
    if (existsSync(stat))
      return !/^\d+ \(.*\) Z /.test(readFileSync(stat, 'utf8'));
    return spawnSync('kill', ['-0', String(pid)]).status === 0;
  };
  return {
    env: (rules, extra = {}) => ({
      PATH: `${bin}:${process.env.PATH}`,
      NPM_LOG: log,
      FIXTURES: bin,
      FAKE_NPM: rules,
      ...extra,
    }),
    calls: () => lines(log),
    aliveChildren: () => lines(`${log}.pids`).map(Number).filter(alive),
    reset: () => {
      rmSync(log, { force: true });
      rmSync(`${log}.pids`, { force: true });
    },
    cleanup: () => rmSync(bin, { recursive: true, force: true }),
  };
}
