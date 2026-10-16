// Свежесть снимка самопроверки (находка аудита 2026-10: смок сверял failed: [],
// но не возраст снимка, и остановившийся selfCheckHourly оставлял зелёное
// сутками). Здесь — границы порога, сверка с реальным @Cron (правило №4) и пин
// шага смока (поле контроллера и чтение смоком обязаны совпадать).
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import {
  SELF_CHECK_CRON,
  STARTUP_GRACE_MS,
  isSnapshotStale,
  maxSnapshotAgeMs,
} from './freshness';
import { scanCronClaims } from '../../test-support/cron-source-scan';

const ROOT = resolve(__dirname, '..', '..', '..');
const HOUR = 3_600_000;

// Пин шага смока. Подстрока по всему файлу не пин: строка jq, закомментированная
// или унесённая в соседний шаг, оставляла бы её зелёной. yaml-парсера среди
// зависимостей нет (js-yaml только транзитивный), поэтому шаг режется по
// строкам `- name:`, а комментарии выкидываются до проверки.
const SMOKE_STEP = '/health — самопроверка';

/** Тело `run:` шага `- name: <префикс>…` без комментариев; null — шага или `run:` нет. */
function stepRunBody(yml: string, namePrefix: string): string | null {
  const lines = yml.split('\n');
  const start = lines.findIndex(
    (l) =>
      /^\s*- name:\s/.test(l) &&
      l.replace(/^\s*- name:\s*/, '').startsWith(namePrefix),
  );
  if (start < 0) return null;
  const stepIndent = lines[start].search(/\S/);
  let runIndent = -1;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const indent = line.search(/\S/);
    if (indent === -1 || line.trim().startsWith('#')) continue;
    if (indent <= stepIndent) break; // начался следующий шаг
    if (runIndent === -1) {
      const m = /^\s*run:\s*(?:\|[-+]?)?\s*(.*)$/.exec(line);
      if (m) {
        runIndent = indent;
        if (m[1]) body.push(m[1]);
      }
    } else if (indent > runIndent) {
      body.push(line.trim());
    } else {
      break; // следующий ключ шага после run:
    }
  }
  return runIndent === -1 ? null : body.join('\n');
}

/** Есть ли в теле `run:` боевая проверка `jq -e '.selfCheck.stale == false'`. */
function hasStaleCheck(run: string | null): boolean {
  return run !== null && /\bjq\s+-e\s+'\.selfCheck\.stale == false'/.test(run);
}

describe('maxSnapshotAgeMs', () => {
  it('часовой крон → два часа: один пропущенный тик допустим, два — нет', () => {
    expect(maxSnapshotAgeMs()).toBe(2 * HOUR);
  });
});

describe('isSnapshotStale', () => {
  const NOW = 1_800_000_000_000;

  it('ровно два часа назад → ещё не протух, на миллисекунду больше → протух', () => {
    expect(isSnapshotStale({ ranAt: NOW - 2 * HOUR }, NOW, 0)).toBe(false);
    expect(isSnapshotStale({ ranAt: NOW - 2 * HOUR - 1 }, NOW, 0)).toBe(true);
  });

  it('свежий снимок не протух, даже если процесс живёт сутки', () => {
    expect(isSnapshotStale({ ranAt: NOW - 1000 }, NOW, 24 * HOUR)).toBe(false);
  });

  it('снимка нет: в грейсе старта не протух, после грейса — протух', () => {
    expect(isSnapshotStale({ ranAt: null }, NOW, STARTUP_GRACE_MS)).toBe(false);
    expect(isSnapshotStale({ ranAt: null }, NOW, STARTUP_GRACE_MS + 1)).toBe(
      true,
    );
  });
});

describe('сверка с реальными источниками', () => {
  it('SELF_CHECK_CRON совпадает с @Cron в self-check.service.ts', () => {
    const claim = scanCronClaims().find(
      (c) => c.claimName === 'selfCheckHourly',
    );
    expect(claim?.cron).toBe(SELF_CHECK_CRON);
  });

  const smoke = readFileSync(
    join(ROOT, '.github', 'workflows', 'prod-smoke.yml'),
    'utf8',
  );

  it('шаг смока «/health — самопроверка…» проверяет stale в своём run:', () => {
    const run = stepRunBody(smoke, SMOKE_STEP);
    expect(run).not.toBeNull();
    expect(hasStaleCheck(run)).toBe(true);
  });
});

describe('пин шага смока: stale проверяется именно в его run:', () => {
  const CHECK = `printf '%s' "$body" | jq -e '.selfCheck.stale == false'`;
  // `target` — тело run: проверяемого шага, `before` — тело run: соседнего.
  const yml = (target: string, before = '          echo up') => `jobs:
  smoke:
    steps:
      - name: /health — 200 и db":"up"
        run: |
${before}
      - name: /health — самопроверка без упавших проб и не протухла
        run: |
${target}
      - name: / — 200
        run: |
          echo site
`;

  it('боевая проверка в run: нужного шага → пин зелёный', () => {
    const run = stepRunBody(yml(`          ${CHECK}`), SMOKE_STEP);
    expect(hasStaleCheck(run)).toBe(true);
  });

  it('контроль: та же строка закомментирована внутри run: → пин краснеет', () => {
    const run = stepRunBody(yml(`          # ${CHECK}`), SMOKE_STEP);
    expect(run).not.toBeNull();
    expect(hasStaleCheck(run)).toBe(false);
  });

  it('контроль: строка в комментарии между шагами → пин краснеет', () => {
    const run = stepRunBody(
      yml(`          echo ok\n      # ${CHECK}`),
      SMOKE_STEP,
    );
    expect(run).not.toBeNull();
    expect(hasStaleCheck(run)).toBe(false);
  });

  it('контроль: строка живёт в другом шаге, а в нужном нет → пин краснеет', () => {
    const run = stepRunBody(
      yml('          echo ok', `          ${CHECK}`),
      SMOKE_STEP,
    );
    expect(run).not.toBeNull();
    expect(hasStaleCheck(run)).toBe(false);
  });

  it('шага нет вовсе → null, пин краснеет', () => {
    expect(
      stepRunBody('steps:\n  - name: other\n    run: x\n', SMOKE_STEP),
    ).toBeNull();
    expect(hasStaleCheck(null)).toBe(false);
  });
});
