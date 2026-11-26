// Повторы curl в смоке прода (prod-smoke.yml). Без `--retry-all-errors` curl
// не повторяет TLS-обрыв (exit 35): две вспышки сети красили смок здорового
// прода и открывали ложный ci-alarm (docs/INCIDENTS.md, 2026-11-14). Флаг
// берёт и 4xx/5xx, поэтому `--fail` должен остаться: после исчерпания попыток
// curl всё равно выходит с кодом 22, устойчивый 5xx не становится зелёным.
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
import {
  jobBody,
  runBlock,
  stepName,
  steps,
} from '../test-support/workflow-steps';

const YML = readFileSync(
  join(process.cwd(), '.github', 'workflows', 'prod-smoke.yml'),
  'utf8',
);

// Все вызовы curl с флагами: общий `CURL:` и инлайновые в шагах.
const CURL_LINES = YML.split('\n')
  .map((l) => l.trim())
  .filter((l) => !l.startsWith('#') && /\bcurl\s+-/.test(l));

describe('prod-smoke: curl повторяет любую ошибку связи', () => {
  it('вызовы curl найдены (общий CURL, /app/, DM в Telegram)', () => {
    expect(CURL_LINES.length).toBeGreaterThanOrEqual(3);
  });

  it.each(CURL_LINES)('%s — с --retry-all-errors и паузой', (line) => {
    expect(line).toMatch(/--retry \d/);
    expect(line).toContain('--retry-all-errors');
    expect(line).toContain('--retry-delay');
  });

  it('общий CURL держит --fail: устойчивый 5xx после повторов остаётся красным', () => {
    const common = CURL_LINES.find((l) => l.startsWith('CURL:'));
    expect(common).toContain('--fail');
  });
});

describe('prod-smoke: шаг /app/ читает последнюю попытку', () => {
  const step = steps(jobBody(YML, 'prod-smoke')).find((s) =>
    stepName(s).startsWith('/app/'),
  );
  let dir: string;
  let log: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'smoke-app-'));
    log = join(dir, 'curl.log');
    writeFileSync(
      join(dir, 'curl'),
      '#!/bin/sh\necho "CALL $*" >> "$CURL_LOG"\nprintf \'%s\' "$FAKE_RESULT"\n',
    );
    chmodSync(join(dir, 'curl'), 0o755);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  function run(result: string) {
    if (existsSync(log)) rmSync(log);
    const r = spawnSync('bash', ['-e', '-c', runBlock(step!)], {
      env: {
        PATH: `${dir}:${process.env.PATH}`,
        CURL_LOG: log,
        FAKE_RESULT: result,
      },
      encoding: 'utf8',
    });
    return { code: r.status, calls: readFileSync(log, 'utf8') };
  }

  it('шаг найден в настоящем YAML', () => {
    expect(step).toBeDefined();
  });

  it('код и адрес — из -w (один раз, по последней попытке), не из -D: он печатает заголовки каждой', () => {
    const r = run('302 https://schemehappens.ru/today?startapp=probe');
    expect(r.calls).toContain('-w');
    expect(r.calls).not.toMatch(/ -D /);
  });

  it('контроль: 302 на /today?startapp=probe → зелёный', () => {
    expect(run('302 https://schemehappens.ru/today?startapp=probe').code).toBe(
      0,
    );
  });

  it('503 после повторов → красный', () => {
    expect(run('503 ').code).not.toBe(0);
  });

  it('302 не в кабинет → красный', () => {
    expect(run('302 https://schemehappens.ru/other').code).not.toBe(0);
  });
});
