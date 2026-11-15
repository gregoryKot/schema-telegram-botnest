// scripts/agent/precheck.mjs — «быстрые гейты CI в чистом дереве перед пушем».
// Инструмент врёт тихо в двух местах, оба под тестом:
//  1) список гейтов: берётся из .github/workflows/ci.yml, и пропущенная
//     команда означает гейт, который агент считает проверенным, а он не
//     запускался; список пропусков NEEDS_BUILD не должен ни протухнуть, ни
//     проглотить обычный гейт (правило №15);
//  2) чистое дерево: потерянный застейдженный файл или просочившийся
//     игнорируемый — ровно тот самый «зелёно локально, красно в CI».
// Чистое дерево — в agent-precheck-tree.spec.ts. Весь precheck целиком в jest не
// гоняем (десятки секунд) — только `--list`.
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

const ROOT = resolve(__dirname, '..', '..');
const AGENT_DIR = join(ROOT, 'scripts', 'agent');
const PRECHECK = join(AGENT_DIR, 'precheck.mjs');
const LIB = join(AGENT_DIR, 'precheck-lib.mjs');
const CI_YML = join(ROOT, '.github', 'workflows', 'ci.yml');

interface Gate {
  job: string;
  script: string;
  args: string[];
  command: string;
}

/** Выполняет выражение в ESM-подпроцессе с модулем `mod` и возвращает его JSON. */
function evalModule<T>(file: string, expr: string): T {
  const code =
    `import * as mod from ${JSON.stringify(pathToFileURL(file).href)};\n` +
    `import { readFileSync } from 'node:fs';\n` +
    `process.stdout.write(JSON.stringify(${expr}));`;
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`${file}: ${res.stderr}`);
  return JSON.parse(res.stdout) as T;
}

const lib = <T>(expr: string): T => evalModule<T>(LIB, expr);
const gatesOf = (yaml: string): Gate[] =>
  lib<Gate[]>(`mod.gatesFromWorkflow(${JSON.stringify(yaml)})`);

const SAMPLE = `name: CI
on:
  push:
    branches: [main]
# - run: node scripts/check-top-comment.mjs
jobs:
  backend:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - run: npm ci
      # - run: node scripts/check-commented-out.mjs
      - run: node scripts/check-one.mjs
      - run: node scripts/check-two.mjs --package webapp # хвостовой комментарий
  checks:  # джоба с комментарием
    steps:
      - run: node scripts/check-one.mjs
      - run: node scripts/setup-merge-drivers.mjs --check
      - name: шаг с именем
        run: node scripts/check-named.mjs
      - run: node scripts/check-two.mjs --package shared
      - run: npx tsc --noEmit
      - run: node scripts/not-a-gate.js
      - run: node scripts/check-chain.mjs && echo ok
other:
  - run: node scripts/check-outside-jobs.mjs
`;

describe('gatesFromWorkflow: разбор ci.yml', () => {
  const gates = gatesOf(SAMPLE);

  it('берёт команды по порядку файла и запоминает джобу', () => {
    expect(gates.map((g) => [g.job, g.command])).toEqual([
      ['backend', 'node scripts/check-one.mjs'],
      ['backend', 'node scripts/check-two.mjs --package webapp'],
      ['checks', 'node scripts/setup-merge-drivers.mjs --check'],
      ['checks', 'node scripts/check-named.mjs'],
      ['checks', 'node scripts/check-two.mjs --package shared'],
    ]);
  });

  it('повтор — та же команда целиком: остаётся первая джоба, а те же скрипты с другими аргументами — разные гейты', () => {
    expect(gates.filter((g) => g.script === 'check-one.mjs')).toHaveLength(1);
    expect(gates.find((g) => g.script === 'check-one.mjs')?.job).toBe(
      'backend',
    );
    expect(gates.filter((g) => g.script === 'check-two.mjs')).toHaveLength(2);
  });

  it('аргументы отдельным списком; комментарии, не-node шаги и чужие секции не гейты', () => {
    expect(
      gates.find((g) => g.script === 'setup-merge-drivers.mjs')?.args,
    ).toEqual(['--check']);
    const scripts = gates.map((g) => g.script);
    for (const noise of [
      'check-top-comment.mjs',
      'check-commented-out.mjs',
      'not-a-gate.js',
      'check-chain.mjs',
      'check-outside-jobs.mjs',
    ]) {
      expect(scripts).not.toContain(noise);
    }
  });
});

// Свёрнутый `run: >-` — так записан e2e-шаг джобы backend под сторожем: длинный список спеков
// в одной строке не прочитать. Оболочка получает строки блока одной командой через пробел.
const FOLDED = `jobs:
  backend:
    steps:
      - name: e2e под сторожем
        timeout-minutes: 5
        run: >-
          node scripts/check-folded.mjs --budget 9 --
          npx jest --config ./test/jest-e2e.json

          test/a test/b
        env:
          X: '1'
      - run: >-
          npx jest --config ./test/jest-e2e.json
          node scripts/check-mid-command.mjs
      - run: >-
          node scripts/check-folded-chain.mjs &&
          echo ok
      - run: |
          node scripts/check-literal.mjs
      - run: node scripts/check-after.mjs
`;

describe('gatesFromWorkflow: свёрнутый run: >-', () => {
  const gates = gatesOf(FOLDED);

  it('строки блока — одна команда через пробел; ключ после блока (env:) в неё не попадает', () => {
    expect(gates.map((g) => g.command)).toEqual([
      'node scripts/check-folded.mjs --budget 9 -- npx jest --config ./test/jest-e2e.json test/a test/b',
      'node scripts/check-after.mjs',
    ]);
    expect(gates[0]).toMatchObject({
      job: 'backend',
      script: 'check-folded.mjs',
    });
  });

  it('контроль: node scripts не в начале команды, цепочка через && и литеральный run: | — не гейты', () => {
    const scripts = gates.map((g) => g.script);
    for (const noise of [
      'check-mid-command.mjs',
      'check-folded-chain.mjs',
      'check-literal.mjs',
    ]) {
      expect(scripts).not.toContain(noise);
    }
  });
});

describe('настоящий ci.yml', () => {
  const ci = readFileSync(CI_YML, 'utf8');
  const all = gatesOf(ci);
  const split = lib<{ run: Gate[]; skipped: Gate[] }>(
    `mod.splitGates(mod.gatesFromWorkflow(readFileSync(${JSON.stringify(CI_YML)}, 'utf8')))`,
  );
  const needsBuild = lib<Record<string, string>>('mod.NEEDS_BUILD');

  it('каждая команда `node scripts/…` из ci.yml разобрана (ни один гейт не выпал молча)', () => {
    const known = all.map((g) => g.command);
    const lost: string[] = [];
    for (const line of ci.split('\n')) {
      if (line.trim().startsWith('#') || !line.includes('node scripts/'))
        continue;
      const command = line
        .slice(line.indexOf('node scripts/'))
        .replace(/\s#.*$/, '')
        .trim();
      // Первая строка свёрнутого `run: >-` — начало склеенной команды.
      if (!known.some((k) => k === command || k.startsWith(`${command} `)))
        lost.push(line.trim());
    }
    expect(lost).toEqual([]);
  });

  it('e2e-шаг джобы backend (свёрнутый run под сторожем) разобран и пропущен, как юнит-прогон', () => {
    const guards = split.skipped.filter(
      (g) => g.script === 'jest-exit-guard.mjs',
    );
    expect(guards.map((g) => g.job)).toEqual(['backend', 'backend']);
    expect(
      guards.filter((g) => g.args.includes('./test/jest-e2e.json')),
    ).toHaveLength(1);
  });

  it('список пропусков: каждая запись есть в ci.yml и объяснена', () => {
    const inCi = new Set(all.map((g) => g.script));
    for (const [script, reason] of Object.entries(needsBuild)) {
      expect(inCi.has(script)).toBe(true);
      expect(reason.length).toBeGreaterThanOrEqual(20);
    }
  });

  it('гейт вне списка запускается; из списка — пропускается (все его варианты с аргументами)', () => {
    const runScripts = split.run.map((g) => g.script);
    expect(runScripts).toContain('check-route-collisions.mjs');
    expect(runScripts).toContain('check-agent-docs.mjs');
    expect(split.run.length + split.skipped.length).toBe(all.length);
    for (const gate of split.run)
      expect(needsBuild).not.toHaveProperty(gate.script);
    expect(split.skipped.map((g) => g.script)).toContain(
      'check-eslint-ratchet.mjs',
    );
    expect(
      split.skipped.filter(
        (g) => g.script === 'check-frontend-coverage-ratchet.mjs',
      ),
    ).toHaveLength(2);
  });

  it('контроль: неизвестный гейт не пропускается, известный из списка — пропускается с причиной', () => {
    const fake = [
      {
        job: 'x',
        script: 'check-brand-new.mjs',
        args: [],
        command: 'node scripts/check-brand-new.mjs',
      },
      {
        job: 'x',
        script: 'check-eslint-ratchet.mjs',
        args: [],
        command: 'node scripts/check-eslint-ratchet.mjs',
      },
    ];
    const res = lib<{ run: Gate[]; skipped: Array<Gate & { reason: string }> }>(
      `mod.splitGates(${JSON.stringify(fake)})`,
    );
    expect(res.run.map((g) => g.script)).toEqual(['check-brand-new.mjs']);
    expect(res.skipped.map((g) => g.script)).toEqual([
      'check-eslint-ratchet.mjs',
    ]);
    expect(res.skipped[0].reason).toBe(needsBuild['check-eslint-ratchet.mjs']);
  });
});

describe('форматирование вывода', () => {
  const gate = {
    job: 'checks',
    script: 'check-x.mjs',
    args: [],
    command: 'node scripts/check-x.mjs',
  };

  it('все зелёные — одна строка', () => {
    const out = lib<string>(
      `mod.formatSummary({ total: 45, skipped: 7, failures: [] })`,
    );
    expect(out).toBe(
      '✓ precheck: 45 гейтов зелёные (пропущено 7: нужны сборка/БД — их проверит CI)',
    );
  });

  it('красный: заголовок, последние 15 непустых строк с отступом, без цветов, итог «K из N»', () => {
    const output = Array.from(
      { length: 30 },
      (_, i) => `\x1b[31mстрока ${i + 1}\x1b[0m\n\n`,
    ).join('');
    const block = lib<string>(
      `mod.formatFailure(${JSON.stringify(gate)}, ${JSON.stringify(output)})`,
    );
    const lines = block.split('\n');
    expect(lines[0]).toBe('✗ checks: node scripts/check-x.mjs');
    expect(lines).toHaveLength(16);
    expect(lines[1]).toBe('    строка 16');
    expect(lines[15]).toBe('    строка 30');
    expect(block).not.toContain('\x1b');
    const summary = lib<string>(
      `mod.formatSummary({ total: 45, skipped: 7, failures: [${JSON.stringify(block)}] })`,
    );
    expect(summary.endsWith('\n✗ precheck: 1 из 45 красные')).toBe(true);
  });

  it('очень длинная строка вывода обрезается', () => {
    const block = lib<string>(
      `mod.formatFailure(${JSON.stringify(gate)}, ${JSON.stringify('я'.repeat(5000))})`,
    );
    expect(block.length).toBeLessThan(400);
  });
});

describe('precheck.mjs --list', () => {
  it('печатает, что запустится и что пропущено; код 0; чистое дерево не создаёт', () => {
    const res = spawnSync(process.execPath, [PRECHECK, '--list'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    const [runPart, skipPart] = res.stdout.split('пропускаются');
    expect(runPart).toContain('check-agent-docs.mjs');
    expect(runPart).toContain('check-route-collisions.mjs');
    expect(runPart).not.toContain('check-eslint-ratchet.mjs');
    expect(skipPart).toContain('check-eslint-ratchet.mjs');
    expect(skipPart).not.toContain('check-agent-docs.mjs');
  });
});
