// Сторож длинной сессии .claude/hooks/context-guard.mjs: молчит, пока сессия
// дешёвая; вырос или сжимался контекст — начатую задачу передать или довести, новую не начинать.
import { execFileSync, spawnSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';

const ROOT = resolve(__dirname, '..', '..');
const GUARD = join(ROOT, '.claude', 'hooks', 'context-guard.mjs');
const MERGE = join(ROOT, '.claude', 'hooks', 'gh-merge.mjs');

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'context-guard-'));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

const usageLine = (tokens: number, sidechain = false) =>
  JSON.stringify({
    type: 'assistant',
    isSidechain: sidechain,
    message: {
      usage: {
        input_tokens: 2,
        cache_creation_input_tokens: 1000,
        cache_read_input_tokens: tokens - 1002,
        output_tokens: 50,
      },
    },
  });

function run(
  event: object,
  lines?: string[],
  extraEnv: NodeJS.ProcessEnv = {},
) {
  const transcript = join(tmp, 'session.jsonl');
  if (lines) writeFileSync(transcript, lines.join('\n') + '\n');
  const env = { ...process.env, ...extraEnv };
  delete env.CLAUDE_CONTEXT_GUARD_TOKENS;
  return spawnSync('node', [GUARD], {
    input: JSON.stringify({ transcript_path: transcript, ...event }),
    encoding: 'utf8',
    env,
    timeout: 5000,
  });
}

const PROMPT = { hook_event_name: 'UserPromptSubmit' };

const bash = (command: string, response: object = {}) => ({
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command },
  tool_response: { stdout: '', stderr: '', interrupted: false, ...response },
});

/** Журнал-канал: хук, открывший его на чтение, висел бы до таймаута без вывода. */
function pipeTranscript() {
  const path = join(tmp, 'pipe.jsonl');
  execFileSync('mkfifo', [path]);
  return path;
}

/** bashMerge из gh-merge.mjs на каждом событии — одним ESM-подпроцессом. */
function mergeKinds(events: object[]): string[] {
  const code =
    `import { bashMerge } from ${JSON.stringify(pathToFileURL(MERGE).href)};\n` +
    `process.stdout.write(JSON.stringify(${JSON.stringify(events)}.map(bashMerge)));`;
  const res = spawnSync('node', ['--input-type=module', '-e', code], {
    encoding: 'utf8',
  });
  return JSON.parse(res.stdout) as string[];
}

describe('хук context-guard.mjs', () => {
  it('контекст ниже порога — молчит (вывод хука попадает в контекст)', () => {
    const res = run(PROMPT, [usageLine(40_000)]);
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });

  it('контекст выше порога — одна строка: размер и что делать', () => {
    const res = run(PROMPT, [usageLine(40_000), usageLine(130_000)]);
    expect(res.stdout.trim().split('\n')).toHaveLength(1);
    expect(res.stdout).toContain('~130 тыс. токенов');
    expect(res.stdout).toContain('.claude/skills/handoff/SKILL.md');
  });

  it('начатую задачу передать: сама, через родителя, иначе доводить здесь; стоп только для новой', () => {
    const out = run(PROMPT, [usageLine(130_000)]).stdout;
    const steps = [
      '1) start_session (user_asked, fresh',
      '2) отказ, а тебя запустила другая сессия',
      '«нужно продолжение: записка <путь>»',
      '3) не вышло и это — доводи здесь до мержа',
    ].map((step) => out.indexOf(step));
    expect(steps.every((at) => at >= 0)).toBe(true);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(out).toContain('Владельца не жди ни в одном случае');
    const stops = out.split(/(?<=\.) /).filter((s) => s.includes('остановись'));
    expect(stops).toHaveLength(1);
    expect(stops[0]).toMatch(/^Новую задачу здесь не начинай/);
  });

  it('берётся последний замер основной ветки, расход субагента не в счёт', () => {
    const res = run(PROMPT, [usageLine(40_000), usageLine(500_000, true)]);
    expect(res.stdout).toBe('');
  });

  it('сессия уже сжималась — стоп-сигнал и при маленьком контексте', () => {
    const boundary = JSON.stringify({
      type: 'system',
      subtype: 'compact_boundary',
    });
    const res = run(PROMPT, [usageLine(150_000), boundary, usageLine(30_000)]);
    expect(res.stdout).toContain('уже сжимался');
    expect(res.stdout).not.toContain('тыс. токенов');
  });

  it('контроль: текст о сжатии внутри ответа инструмента сжатием не считается', () => {
    const quoted = JSON.stringify({
      type: 'user',
      content: '{"type":"system","subtype":"compact_boundary"}',
    });
    expect(run(PROMPT, [quoted, usageLine(30_000)]).stdout).toBe('');
  });

  it('мерж PR при дорогом контексте — additionalContext для агента', () => {
    const res = run({ hook_event_name: 'PostToolUse' }, [usageLine(130_000)]);
    const out = JSON.parse(res.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    const ctx: string = out.hookSpecificOutput.additionalContext;
    expect(ctx).toContain('PR вмержен: проверь деплой');
    expect(ctx).toContain('start_session');
    expect(ctx).not.toContain('остановись');
  });

  it('мерж через `gh pr merge` в Bash при дорогом контексте — тот же сигнал; автомерж — дождаться', () => {
    const context = (command: string) =>
      JSON.parse(run(bash(command), [usageLine(130_000)]).stdout)
        .hookSpecificOutput.additionalContext as string;
    expect(context('gh pr merge 12 --squash')).toContain(
      'PR вмержен: проверь деплой',
    );
    const auto = context('cd /repo && gh pr merge 12 --squash --auto');
    expect(auto).toContain('ждёт автомержа: дождись мержа');
    expect(auto).toContain('start_session');
  });

  describe('мерж за пайпом: исход сверяется `gh pr view` (gh подменён)', () => {
    /** Подменный gh в PATH: пишет аргументы в calls.txt и выполняет body. */
    function fakeGh(body: string): NodeJS.ProcessEnv {
      const bin = join(tmp, 'bin');
      mkdirSync(bin);
      const script = join(bin, 'gh');
      writeFileSync(
        script,
        `#!/bin/sh\necho "$@" >> "${join(tmp, 'calls.txt')}"\n${body}\n`,
        {
          mode: 0o755,
        },
      );
      return {
        PATH: `${bin}:${process.env.PATH}`,
        CLAUDE_GH_VIEW_TIMEOUT_MS: '1500',
      };
    }
    const calls = () =>
      existsSync(join(tmp, 'calls.txt'))
        ? readFileSync(join(tmp, 'calls.txt'), 'utf8')
        : '';
    const PIPED = 'gh pr merge 12 --squash 2>&1 | tail -n 3';
    const guard = (command: string, env: NodeJS.ProcessEnv) =>
      run(bash(command), [usageLine(130_000)], env).stdout;
    const context = (out: string) =>
      JSON.parse(out).hookSpecificOutput.additionalContext as string;

    it('пайп + MERGED — «PR вмержен», спрошен тот самый PR', () => {
      const out = guard(
        PIPED,
        fakeGh(`echo '{"state":"MERGED","autoMergeRequest":null}'`),
      );
      expect(context(out)).toContain('PR вмержен: проверь деплой');
      expect(calls().trim()).toBe('pr view 12 --json state,autoMergeRequest');
    });

    it('пайп + провал мержа (PR открыт без автомержа) — молчит', () => {
      const out = guard(
        PIPED,
        fakeGh(`echo '{"state":"OPEN","autoMergeRequest":null}'`),
      );
      expect(out).toBe('');
      expect(calls()).toContain('pr view 12');
    });

    it('пайп + OPEN с автомержем — «ждёт автомержа»; ветка и --repo уходят в gh', () => {
      const env = fakeGh(
        `echo '{"state":"OPEN","autoMergeRequest":{"mergeMethod":"SQUASH"}}'`,
      );
      const out = guard('gh pr merge feat/x -R o/r --squash | tail -n 1', env);
      expect(context(out)).toContain('ждёт автомержа');
      expect(calls().trim()).toBe(
        'pr view feat/x --json state,autoMergeRequest --repo o/r',
      );
    });

    it('пайп + таймаут gh — без «вмержен», строка-предупреждение', () => {
      const out = guard(PIPED, fakeGh('exec sleep 5'));
      const ctx = context(out);
      expect(ctx).toContain('не проверен (таймаут gh pr view)');
      expect(ctx).not.toContain('вмержен');
    });

    it('без пайпа — сигнал по коду выхода, gh не вызывается', () => {
      const out = guard('gh pr merge 12 --squash', fakeGh('exit 1'));
      expect(context(out)).toContain('PR вмержен: проверь деплой');
      expect(calls()).toBe('');
    });

    it('ниже порога — молчит и в сеть не ходит', () => {
      const res = run(bash(PIPED), [usageLine(40_000)], fakeGh('exit 1'));
      expect([res.stdout, calls()]).toEqual(['', '']);
    });
  });

  it('прочий Bash-вызов — тихий выход 0 до чтения журнала', () => {
    const res = run({
      ...bash('git status --short'),
      transcript_path: pipeTranscript(),
    });
    expect([res.status, res.stdout]).toEqual([0, '']);
  });

  it('мерж — вызов `gh pr merge`, а не упоминание; --disable-auto и фоновый вызов не в счёт', () => {
    const table: [string, string, object?][] = [
      ['gh pr merge 12 --squash 2>&1 | tail -n 3', 'merged'],
      ['GH_REPO=o/r gh pr merge "$PR" --subject "a; b" --squash', 'merged'],
      ['gh pr checks 12 --watch && gh pr merge 12 --squash', 'merged'],
      [
        "git commit -F - <<'EOF' && gh pr merge 12 --squash\nтекст\nEOF",
        'merged',
      ],
      ['(cd repo && gh pr merge 12 --auto --squash)', 'auto'],
      ['gh pr merge 12 --disable-auto', ''],
      ['grep -n "gh pr merge" docs/BACKLOG.md', ''],
      ["git commit -F - <<'EOF'\nСторож: сигнал на gh pr merge\nEOF", ''],
      ['gh pr view 12 --json state', ''],
      ['gh pr merge 12 --squash', '', { backgroundTaskId: 'b1' }],
    ];
    const kinds = mergeKinds(table.map(([c, , res]) => bash(c, res)));
    expect(table.map(([c], i) => [c, kinds[i]])).toEqual(
      table.map(([c, kind]) => [c, kind]),
    );
  });

  it('старт после сжатия говорит сразу, без журнала', () => {
    const res = run({ hook_event_name: 'SessionStart', source: 'compact' });
    expect(res.stdout).toContain('уже сжимался');
  });

  it('мусор на входе и журнал, которого нет, — тихий выход 0', () => {
    const garbage = spawnSync('node', [GUARD], {
      input: 'не json',
      encoding: 'utf8',
    });
    expect([garbage.status, garbage.stdout]).toEqual([0, '']);
    const missing = run(PROMPT);
    expect([missing.status, missing.stdout]).toEqual([0, '']);
  });

  it('хук подключён в .claude/settings.json на все три события', () => {
    const { hooks } = JSON.parse(
      readFileSync(join(ROOT, '.claude', 'settings.json'), 'utf8'),
    );
    const wired = (event: string, matcher?: string) =>
      hooks[event].some(
        (h: { matcher?: string; hooks: { command: string }[] }) =>
          h.matcher === matcher &&
          h.hooks.some((c) => c.command.includes('context-guard.mjs')),
      );
    expect(wired('UserPromptSubmit')).toBe(true);
    expect(wired('SessionStart', 'compact')).toBe(true);
    expect(wired('PostToolUse', 'mcp__github__merge_pull_request')).toBe(true);
    expect(wired('PostToolUse', 'Bash')).toBe(true);
  });
});
