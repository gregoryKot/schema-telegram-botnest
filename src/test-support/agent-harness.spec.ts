// Замер контекста агента: хук .claude/hooks/log-tool-use.mjs пишет журнал,
// scripts/agent/session-report.mjs сворачивает его в отчёт для /retro.
// Хук исполняется Claude Code на КАЖДЫЙ вызов инструмента, поэтому главное —
// он молчит (stdout хука попадает в контекст) и никогда не падает.
import { spawnSync } from 'child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const HOOK = join(ROOT, '.claude', 'hooks', 'log-tool-use.mjs');
const REPORT = join(ROOT, 'scripts', 'agent', 'session-report.mjs');

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'agent-harness-'));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

function runHook(stdin: string) {
  const log = join(tmp, 'tool-log.jsonl');
  const res = spawnSync('node', [HOOK, log], {
    input: stdin,
    encoding: 'utf8',
  });
  const lines = existsSync(log)
    ? readFileSync(log, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
    : [];
  return { res, lines };
}

function runReport(entries: object[], ...args: string[]) {
  const log = join(tmp, 'tool-log.jsonl');
  writeFileSync(log, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return spawnSync('node', [REPORT, '--log', log, ...args], {
    encoding: 'utf8',
  });
}

describe('хук log-tool-use.mjs', () => {
  it('Read: путь от корня проекта, размер ответа, без содержимого и без вывода', () => {
    const content = 'секрет клиента '.repeat(100);
    const { res, lines } = runHook(
      JSON.stringify({
        session_id: 's1',
        cwd: '/repo',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/repo/src/bot/bot.service.ts' },
        tool_response: { file: { content } },
      }),
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      session: 's1',
      event: 'PostToolUse',
      tool: 'Read',
      target: 'src/bot/bot.service.ts',
    });
    expect(lines[0].chars).toBe(content.length);
    expect(JSON.stringify(lines[0])).not.toContain('секрет');
  });

  // Замер 2026-10-21: интерфейсные поля раздували счёт в десятки раз.
  it('Bash: считается только вывод, а не дифф для интерфейса', () => {
    const { lines } = runHook(
      JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'python3 fix.py' },
        tool_response: {
          stdout: 'ok\n',
          stderr: 'w',
          bashEditDiff: 'x'.repeat(5000),
        },
      }),
    );
    expect(lines[0].chars).toBe(4);
    expect(lines[0].fields.bashEditDiff).toBe(5000);
  });

  it('Edit: правка контекст не наполняет, хотя ответ несёт файл целиком', () => {
    const { lines } = runHook(
      JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: '/repo/a.ts' },
        tool_response: { originalFile: 'y'.repeat(9000), structuredPatch: [] },
      }),
    );
    expect(lines[0].chars).toBe(0);
  });

  it('Bash: адрес — начало команды, длинная команда обрезается', () => {
    const { lines } = runHook(
      JSON.stringify({
        session_id: 's1',
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: `npx jest ${'x'.repeat(400)}` },
        tool_response: { stdout: 'ok' },
      }),
    );
    expect(lines[0].target.startsWith('npx jest')).toBe(true);
    expect(lines[0].target.length).toBeLessThanOrEqual(161);
  });

  it('InstructionsLoaded: какое правило и почему загрузилось', () => {
    const { lines } = runHook(
      JSON.stringify({
        session_id: 's1',
        cwd: '/repo',
        hook_event_name: 'InstructionsLoaded',
        file_path: '/repo/.claude/rules/tests.md',
        load_reason: 'path_glob_match',
        trigger_file_path: '/repo/src/x.spec.ts',
      }),
    );
    expect(lines[0]).toMatchObject({
      event: 'InstructionsLoaded',
      target: '.claude/rules/tests.md',
      reason: 'path_glob_match',
      by: 'src/x.spec.ts',
    });
  });

  it('мусор на входе — тихий выход 0 без журнала', () => {
    const { res, lines } = runHook('не json');
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
    expect(res.stderr).toBe('');
    expect(lines).toEqual([]);
  });
});

describe('отчёт session-report.mjs', () => {
  const read = (session: string, target: string, chars: number) => ({
    session,
    event: 'PostToolUse',
    tool: 'Read',
    target,
    chars,
  });

  it('пустой журнал — честное «нет данных», а не нули', () => {
    const res = runReport([]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Журнал пуст');
    expect(res.stdout).not.toMatch(/NaN|undefined/);
  });

  it('последняя сессия: итог, документы против кода, повторы, дорогие команды, правила', () => {
    const res = runReport([
      read('old', 'src/old.ts', 99999),
      read('s2', 'docs/ARCHITECTURE.md', 12000),
      read('s2', 'src/bot/bot.service.ts', 3000),
      read('s2', 'src/bot/bot.service.ts', 3000),
      {
        session: 's2',
        event: 'PostToolUse',
        tool: 'Bash',
        target: 'npm ci',
        chars: 40000,
      },
      {
        session: 's2',
        event: 'InstructionsLoaded',
        target: '.claude/rules/tests.md',
        reason: 'path_glob_match',
        by: 'src/x.spec.ts',
      },
    ]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Вызовов инструментов: 4');
    expect(res.stdout).not.toContain('src/old.ts');
    expect(res.stdout).toContain(
      'документы 12.0 тыс. знаков, код 6.0 тыс. знаков',
    );
    expect(res.stdout).toContain('2×  src/bot/bot.service.ts');
    expect(res.stdout).toContain('40.0 тыс.  npm ci');
    expect(res.stdout).toContain(
      '.claude/rules/tests.md (path_glob_match ← src/x.spec.ts)',
    );
  });

  it('--all берёт весь журнал', () => {
    const res = runReport(
      [read('old', 'src/old.ts', 500), read('s2', 'src/new.ts', 500)],
      '--all',
    );
    expect(res.stdout).toContain('Вызовов инструментов: 2');
    expect(res.stdout).toContain('src/old.ts');
  });

  it('битая строка журнала не роняет отчёт', () => {
    const log = join(tmp, 'tool-log.jsonl');
    writeFileSync(log, `${JSON.stringify(read('s', 'a.ts', 10))}\n{недописан`);
    const res = spawnSync('node', [REPORT, '--log', log], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Вызовов инструментов: 1');
  });
});
