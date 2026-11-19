// scripts/playwright-install-retry.sh исполняется с подставным npx: зависшая или упавшая
// установка браузеров повторяется один раз и не съедает таймаут джобы.
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'playwright-install-retry.sh');
const WORKFLOWS = join(ROOT, '.github', 'workflows');

/** Запускает скрипт; behaviours[i] — тело подставного npx на i-й вызов (последнее повторяется). */
function run(behaviours: string[]): { status: number | null; calls: string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'pw-install-'));
  try {
    const log = join(dir, 'calls.log');
    const cases = behaviours.map((b, i) => `${i + 1}) ${b} ;;`).join('\n');
    writeFileSync(
      join(dir, 'npx'),
      `#!/usr/bin/env bash\necho "$*" >> "${log}"\nn=$(wc -l < "${log}")\ncase "$n" in\n${cases}\n*) ${behaviours[behaviours.length - 1]} ;;\nesac\n`,
    );
    writeFileSync(join(dir, 'sudo'), '#!/usr/bin/env bash\nexit 0\n');
    chmodSync(join(dir, 'npx'), 0o755);
    chmodSync(join(dir, 'sudo'), 0o755);
    const res = spawnSync('bash', [SCRIPT, 'chromium', 'webkit'], {
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH ?? ''}`,
        PLAYWRIGHT_INSTALL_ATTEMPT_SECONDS: '1',
      },
      encoding: 'utf8',
      timeout: 20_000,
    });
    return {
      status: res.status,
      calls: readFileSync(log, 'utf8').trim().split('\n'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('playwright-install-retry.sh', () => {
  it('успех с первой попытки — один вызов с переданными браузерами', () => {
    const { status, calls } = run(['exit 0']);
    expect(status).toBe(0);
    expect(calls).toEqual(['playwright install --with-deps chromium webkit']);
  });

  it('упавшая установка повторяется один раз', () => {
    const { status, calls } = run(['exit 1', 'exit 0']);
    expect(status).toBe(0);
    expect(calls).toHaveLength(2);
  });

  it('зависшая установка снимается по потолку времени и повторяется', () => {
    const { status, calls } = run(['sleep 15', 'exit 0']);
    expect(status).toBe(0);
    expect(calls).toHaveLength(2);
  });

  it('две неудачи подряд — шаг красный, третьей попытки нет', () => {
    const { status, calls } = run(['exit 1']);
    expect(status).not.toBe(0);
    expect(calls).toHaveLength(2);
  });

  it('workflow ставят браузеры только через скрипт, шаг — со своим timeout-minutes', () => {
    for (const file of readdirSync(WORKFLOWS).filter((f) =>
      f.endsWith('.yml'),
    )) {
      const lines = readFileSync(join(WORKFLOWS, file), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*#/.test(line)) return;
        expect(`${file}: ${line}`).not.toMatch(/npx playwright install/);
        if (line.includes('playwright-install-retry.sh')) {
          expect(`${file}: ${lines[i - 1]}`).toMatch(/timeout-minutes: \d+/);
        }
      });
    }
  });
});
