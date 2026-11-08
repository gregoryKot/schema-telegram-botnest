// nightly.yml, джоба incident-registry: код 2 гейта check-incident-registry.mjs
// («GitHub API не ответил») — зелёный шаг с предупреждением, а не красный.
// Красный шаг уходит в джобу alarm, и та завела бы ci-alarm на сбой GitHub —
// ложную тревогу, которую через неделю перестают читать. Код 1 (нарушение
// реестра) обязан остаться красным.
//
// Шаг исполняется как в Actions (`bash -e`), вместо node — подставной
// исполняемый файл с заданным кодом выхода.
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { jobBlocks } from './workflow-yaml';

const NIGHTLY = readFileSync(
  join(process.cwd(), '.github', 'workflows', 'nightly.yml'),
  'utf8',
);

/** Тело `run: |` шага джобы, с которого снят отступ. */
function runBlock(job: string): string {
  const lines = job.split('\n');
  const at = lines.findIndex((l) => /^\s+run: \|\s*$/.test(l));
  if (at < 0) throw new Error('у джобы нет многострочного run');
  const body: string[] = [];
  const indent = /^\s*/.exec(lines[at + 1])![0].length;
  for (const l of lines.slice(at + 1)) {
    if (l.trim() && l.search(/\S/) < indent) break;
    body.push(l.slice(indent));
  }
  return body.join('\n');
}

describe('nightly.yml, incident-registry: сбой GitHub — не тревога', () => {
  const script = runBlock(jobBlocks(NIGHTLY)['incident-registry']);
  let bin: string;
  beforeAll(() => {
    bin = mkdtempSync(join(tmpdir(), 'fake-node-'));
    writeFileSync(join(bin, 'node'), '#!/bin/sh\nexit "$FAKE_CODE"\n');
    chmodSync(join(bin, 'node'), 0o755);
  });
  afterAll(() => rmSync(bin, { recursive: true, force: true }));
  const step = (code: number) =>
    spawnSync('bash', ['-e', '-c', script], {
      encoding: 'utf8',
      env: { PATH: `${bin}:/usr/bin:/bin`, FAKE_CODE: String(code) },
    });

  it('шаг зовёт гейт реестра', () => {
    expect(script).toContain('node scripts/check-incident-registry.mjs');
  });

  it('код 2 — зелёный с ::warning::', () => {
    const res = step(2);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('::warning::GitHub API не ответил');
  });

  it('код 1 — красный; код 0 — зелёный без предупреждения', () => {
    expect(step(1).status).toBe(1);
    const ok = step(0);
    expect(ok.status).toBe(0);
    expect(ok.stdout).not.toContain('::warning::');
  });
});
