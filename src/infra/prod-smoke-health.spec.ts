// Шаг «/health — 200 и db:up» смока прода (prod-smoke.yml). Аудит 2026-10,
// «Красный смок не говорит, что именно лежит»: страница техработ отвечает 200,
// и упавший migrate deploy, крашлуп и окно старта давали один и тот же
// красный шаг. Теперь front ставит причину заголовком X-Maintenance-Reason
// (deploy/maintenance-page.mjs), а шаг печатает её до проверок тела. Шаг не
// пересказывается, а исполняется: `run:` из настоящего YAML с подменённым curl.
import { spawnSync } from 'child_process';
import {
  chmodSync,
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
const step = steps(jobBody(YML, 'prod-smoke')).find((s) =>
  stepName(s).startsWith('/health — 200'),
);

// Фейковый curl: заголовки — в файл после -D (как настоящий), тело — в stdout.
const FAKE_CURL = `#!/bin/sh
out=""
while [ $# -gt 0 ]; do
  if [ "$1" = "-D" ]; then shift; out="$1"; fi
  shift
done
[ -n "$out" ] && printf '%b' "$FAKE_HEADERS" > "$out"
printf '%s' "$FAKE_BODY"
`;

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'smoke-health-'));
  writeFileSync(join(dir, 'curl'), FAKE_CURL);
  chmodSync(join(dir, 'curl'), 0o755);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function run(headers: string, body: string) {
  const r = spawnSync('bash', ['-eo', 'pipefail', '-c', runBlock(step!)], {
    cwd: dir,
    env: {
      PATH: `${dir}:${process.env.PATH}`,
      CURL: 'curl --fail --silent --show-error',
      FAKE_HEADERS: headers,
      FAKE_BODY: body,
    },
    encoding: 'utf8',
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const MAINTENANCE = '<!doctype html><h1>Небольшие технические работы</h1>';
const OK_HEAD = 'HTTP/1.1 200 OK\\r\\nContent-Type: text/html\\r\\n';

describe('prod-smoke: шаг /health печатает причину техработ', () => {
  it('шаг найден в настоящем YAML', () => {
    expect(step).toBeDefined();
  });

  it('страница техработ с причиной → шаг красный и называет причину', () => {
    const r = run(
      `${OK_HEAD}X-Maintenance-Reason: migrate-failed\\r\\n\\r\\n`,
      MAINTENANCE,
    );
    expect(r.code).not.toBe(0);
    expect(r.out).toContain(
      '::error::Прод на странице техработ, причина: migrate-failed',
    );
  });

  it('контроль: здоровый /health → зелёный, без строки о техработах', () => {
    const r = run(
      'HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\n\\r\\n',
      '{"status":"ok","db":"up","builtAt":null,"selfCheck":{"failed":[]}}',
    );
    expect(r.code).toBe(0);
    expect(r.out).not.toContain('::error::');
  });

  it('контроль: техработы без заголовка (старый образ) → красный, но без выдуманной причины', () => {
    const r = run(`${OK_HEAD}\\r\\n`, MAINTENANCE);
    expect(r.code).not.toBe(0);
    expect(r.out).not.toContain('причина:');
  });
});
