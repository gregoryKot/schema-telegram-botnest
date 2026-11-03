// Джоба `alarm` в prod-smoke.yml и nightly.yml — наблюдатель за наблюдателем
// (CLAUDE.md, правило №24). До 2026-10-13 её шаг «DM владельцу» без секретов
// BOT_TOKEN/ADMIN_ID печатал «DM не отправлен» и выходил нулём: два реальных
// простоя прода (10-09 и 10-11) прошли при зелёной джобе, а единственная
// проба-замена живёт внутри Nest, которого в таких авариях нет.
//
// Здесь шаг не пересказывается, а ИСПОЛНЯЕТСЯ: `run:` вытаскивается из
// настоящего YAML и идёт в bash с пустыми и заполненными секретами и
// подменённым `curl` в PATH (шов — сам скрипт воркфлоу, не его описание).
// YAML-парсера в зависимостях нет, шаги режутся по отступу, как в
// vps-workflow.spec.ts; слом отступа многострочного run (известная ловушка
// аудита 2026-09) ломает и этот разбор.
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

const WORKFLOWS = join(process.cwd(), '.github', 'workflows');
const read = (file: string) => readFileSync(join(WORKFLOWS, file), 'utf8');

/** Тело джобы `alarm`: от её ключа до следующего ключа джобы (отступ 2). */
function alarmJob(yml: string): string {
  const start = yml.search(/^ {2}alarm:\n/m);
  if (start < 0) throw new Error('джобы alarm нет');
  const rest = yml.slice(start + 1);
  const next = rest.search(/^ {2}\S/m);
  return next < 0 ? rest : rest.slice(0, next);
}

/** Шаги джобы: каждый начинается с `      - ` (отступ 6). */
function steps(job: string): string[] {
  return job.split(/^ {6}- /m).slice(1);
}

const stepName = (s: string) => /^name: (.*)$/m.exec(s)?.[1] ?? '';

function runBlock(step: string): string {
  const lines = step.split('\n');
  const at = lines.findIndex((l) => /^ {8}run: \|\s*$/.test(l));
  if (at < 0) throw new Error(`у шага «${stepName(step)}» нет run: |`);
  const body: string[] = [];
  for (const l of lines.slice(at + 1)) {
    if (l.trim() !== '' && !l.startsWith(' '.repeat(10))) break;
    body.push(l.slice(10));
  }
  return body.join('\n');
}

const dmStep = (file: string) => {
  const found = steps(alarmJob(read(file))).find((s) =>
    stepName(s).startsWith('DM владельцу'),
  );
  if (!found) throw new Error(`шага «DM владельцу» нет в ${file}`);
  return found;
};

let bin: string;
let curlLog: string;

beforeAll(() => {
  bin = mkdtempSync(join(tmpdir(), 'fake-curl-'));
  curlLog = join(bin, 'curl.log');
  const fake = join(bin, 'curl');
  writeFileSync(fake, '#!/bin/sh\necho "CALL $*" >> "$CURL_LOG"\n');
  chmodSync(fake, 0o755);
});
afterAll(() => rmSync(bin, { recursive: true, force: true }));

function runStep(step: string, env: Record<string, string>) {
  if (existsSync(curlLog)) rmSync(curlLog);
  const r = spawnSync('bash', ['-e', '-c', runBlock(step)], {
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      CURL_LOG: curlLog,
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_RUN_ID: '1',
      ...env,
    },
    encoding: 'utf8',
  });
  const curlCalls = existsSync(curlLog)
    ? readFileSync(curlLog, 'utf8')
        .split(/^CALL /m)
        .map((c) => c.trim())
        .filter(Boolean)
    : [];
  return { status: r.status, out: `${r.stdout}${r.stderr}`, curlCalls };
}

const NO_SECRETS = { BOT_TOKEN: '', ADMIN_ID: '' };
const SECRETS = { BOT_TOKEN: 'fake-token', ADMIN_ID: '42' };

describe.each([
  ['prod-smoke.yml', 'created', { NOTIFY: 'created' }],
  ['prod-smoke.yml', 'reminder', { NOTIFY: 'reminder' }],
  ['nightly.yml', 'провал джоб', { FAILED: 'browser-smoke,npm-audit' }],
])('%s: шаг «DM владельцу» (%s)', (file, _label, extra) => {
  const step = dmStep(file);

  it('нет секретов: ненулевой код и ::error, curl не вызван — отсутствие канала видно', () => {
    const r = runStep(step, { ...NO_SECRETS, ...extra });
    expect(r.status).not.toBe(0);
    expect(r.out).toContain('::error::');
    expect(r.out).toContain('BOT_TOKEN/ADMIN_ID');
    expect(r.curlCalls).toEqual([]);
  });

  it.each([
    ['пуст ADMIN_ID', { BOT_TOKEN: 'fake-token', ADMIN_ID: '' }],
    ['пуст BOT_TOKEN', { BOT_TOKEN: '', ADMIN_ID: '42' }],
  ])('%s: тоже красный', (_n, secrets) => {
    const r = runStep(step, { ...secrets, ...extra });
    expect(r.status).not.toBe(0);
    expect(r.curlCalls).toEqual([]);
  });

  it('контроль: с секретами — код 0 и ровно один sendMessage владельцу', () => {
    const r = runStep(step, { ...SECRETS, ...extra });
    expect(r.status).toBe(0);
    expect(r.curlCalls).toHaveLength(1);
    expect(r.curlCalls[0]).toContain(
      'https://api.telegram.org/botfake-token/sendMessage',
    );
    expect(r.curlCalls[0]).toContain('chat_id=42');
  });
});

describe('prod-smoke.yml: «прод снова отвечает» без секретов', () => {
  // Исключение, у которого есть контрольный образец (правило №15 п.2): красный
  // alarm на выздоровлении красил бы весь прогон смока, и проба ciRuns
  // докладывала бы «смок красный» про здоровый прод до следующего тика.
  const step = dmStep('prod-smoke.yml');

  it('recovered: ::warning и код 0 — не красит прогон смока', () => {
    const r = runStep(step, { ...NO_SECRETS, NOTIFY: 'recovered' });
    expect(r.status).toBe(0);
    expect(r.out).toContain('::warning::');
    expect(r.out).not.toContain('::error::');
    expect(r.curlCalls).toEqual([]);
  });

  it('контрольный образец: исключение не шире recovered — любое другое NOTIFY без секретов красное', () => {
    for (const notify of ['created', 'reminder', 'unexpected', '']) {
      expect(runStep(step, { ...NO_SECRETS, NOTIFY: notify }).status).not.toBe(
        0,
      );
    }
  });
});

describe.each(['prod-smoke.yml', 'nightly.yml'])(
  '%s: порядок шагов alarm',
  (file) => {
    const all = steps(alarmJob(read(file)));
    const issueAt = all.findIndex((s) =>
      stepName(s).startsWith('issue ci-alarm'),
    );
    const dmAt = all.findIndex((s) => stepName(s).startsWith('DM владельцу'));

    it('issue ci-alarm заводится ДО DM-шага: красный DM не срывает issue', () => {
      expect(issueAt).toBeGreaterThanOrEqual(0);
      expect(dmAt).toBeGreaterThan(issueAt);
    });

    it('у шага issue нет if: — его исход не зависит от DM и секретов', () => {
      expect(all[issueAt]).not.toMatch(/^ {8}if:/m);
      expect(all[issueAt]).not.toMatch(/secrets\./);
    });

    it('нет continue-on-error у DM-шага: красный шаг не глушится', () => {
      expect(all[dmAt]).not.toMatch(/continue-on-error/);
    });
  },
);
