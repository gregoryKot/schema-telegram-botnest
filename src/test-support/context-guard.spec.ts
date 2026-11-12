// Сторож длинной сессии .claude/hooks/context-guard.mjs: молчит, пока сессия
// дешёвая, и говорит агенту остановиться, когда контекст вырос или сжимался.
import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const GUARD = join(ROOT, '.claude', 'hooks', 'context-guard.mjs');

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

function run(event: object, lines?: string[]) {
  const transcript = join(tmp, 'session.jsonl');
  if (lines) writeFileSync(transcript, lines.join('\n') + '\n');
  const env = { ...process.env };
  delete env.CLAUDE_CONTEXT_GUARD_TOKENS;
  return spawnSync('node', [GUARD], {
    input: JSON.stringify({ transcript_path: transcript, ...event }),
    encoding: 'utf8',
    env,
  });
}

const PROMPT = { hook_event_name: 'UserPromptSubmit' };

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
    expect(out.hookSpecificOutput.additionalContext).toContain('PR вмержен');
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
  });
});
