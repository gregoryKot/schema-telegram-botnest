// Сверка правила №4 CLAUDE.md: реестр CRON_LEASE_WINDOW_KEY — денормализация
// scripts/cron-leader-baseline.json (какие claimRun-имена — leader-кроны) и
// исходников (какое окно реально передано в claimRun для каждого имени).
// Разъезд в любую сторону — тест краснеет, а не молчит.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import {
  CRON_LEASE_WINDOW_KEY,
  NOMINAL_PERIOD_MS,
  maxLeaseAgeMs,
} from './cron-lease-registry';
import { LEASE_WINDOW } from '../cron-leader.service';

const ROOT = resolve(__dirname, '..', '..', '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'cron-leader-baseline.json');

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walk(rel, acc);
    } else if (/\.ts$/.test(name) && !/\.(spec|test)\.ts$/.test(name)) {
      acc.push(rel);
    }
  }
  return acc;
}

/** Все `claimRun('name', LEASE_WINDOW.key)` в src/**, кроме этого модуля
 * самого (selfCheckHourly не мониторит сам себя — см. probe-cron-leases.ts). */
function findClaimRunCalls(): Array<{ name: string; windowKey: string }> {
  const re =
    /claimRun\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*LEASE_WINDOW\.(\w+)/g;
  const out: Array<{ name: string; windowKey: string }> = [];
  for (const rel of walk('src')) {
    if (rel === 'src/infra/self-check/self-check.service.ts') continue;
    const text = readFileSync(join(ROOT, rel), 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) out.push({ name: m[2], windowKey: m[3] });
  }
  return out;
}

describe('CRON_LEASE_WINDOW_KEY — сверка с исходниками', () => {
  const found = findClaimRunCalls();

  it('механизм реально что-то нашёл (иначе проверки ниже пустые и лживо-зелёные)', () => {
    expect(found.length).toBeGreaterThanOrEqual(9);
  });

  it('каждый claimRun в src/** зарегистрирован в реестре с тем же окном', () => {
    const bad = found
      .filter((f) => CRON_LEASE_WINDOW_KEY[f.name] !== f.windowKey)
      .map(
        (f) =>
          `${f.name}: в коде LEASE_WINDOW.${f.windowKey}, в реестре ${CRON_LEASE_WINDOW_KEY[f.name] ?? '<нет>'}`,
      );
    expect(bad).toEqual([]);
  });

  it('в реестре нет протухших имён — каждое встречается в claimRun в коде', () => {
    const names = new Set(found.map((f) => f.name));
    const orphans = Object.keys(CRON_LEASE_WINDOW_KEY).filter(
      (n) => !names.has(n),
    );
    expect(orphans).toEqual([]);
  });
});

describe('CRON_LEASE_WINDOW_KEY — сверка с cron-leader-baseline.json', () => {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Record<
    string,
    { status: string }
  >;
  const leaderMethodCount = Object.values(baseline).filter(
    (v) => v.status === 'leader',
  ).length;

  it('число leader-кронов в бейслайне не меньше числа записей реестра (реестр — их подмножество, минус сам selfCheckHourly)', () => {
    expect(leaderMethodCount).toBeGreaterThanOrEqual(
      Object.keys(CRON_LEASE_WINDOW_KEY).length,
    );
  });
});

describe('NOMINAL_PERIOD_MS / maxLeaseAgeMs', () => {
  it('покрывает каждую категорию LEASE_WINDOW', () => {
    expect(Object.keys(NOMINAL_PERIOD_MS).sort()).toEqual(
      Object.keys(LEASE_WINDOW).sort(),
    );
  });

  it('окно аренды всегда меньше номинального периода той же категории', () => {
    for (const key of Object.keys(LEASE_WINDOW) as Array<
      keyof typeof LEASE_WINDOW
    >) {
      expect(LEASE_WINDOW[key]).toBeLessThan(NOMINAL_PERIOD_MS[key]);
    }
  });

  it('maxLeaseAgeMs — ровно 2 номинальных периода, null для неизвестного имени', () => {
    expect(maxLeaseAgeMs('bookingExpireHolds')).toBe(
      2 * NOMINAL_PERIOD_MS.everyMinute,
    );
    expect(maxLeaseAgeMs('midnightPlanner')).toBe(2 * NOMINAL_PERIOD_MS.daily);
    expect(maxLeaseAgeMs('неизвестное-имя')).toBeNull();
  });
});
