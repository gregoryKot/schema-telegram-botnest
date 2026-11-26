// Хук scripts/git-hooks/commit-msg: коммит — одна строка-заголовок и трейлеры.
import { spawnSync } from 'child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { REAL_SCRIPTS_DIR } from './gate-sandbox';

const HOOK = join(REAL_SCRIPTS_DIR, 'git-hooks', 'commit-msg');
const TRAILERS =
  'Co-Authored-By: Claude <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_x';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'commit-msg-'));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

const run = (message: string) => {
  const file = join(tmp, 'COMMIT_EDITMSG');
  writeFileSync(file, message);
  return spawnSync('node', [HOOK, file], { encoding: 'utf8' });
};

describe('commit-msg хук: тела у коммита нет', () => {
  it('заголовок и трейлеры — проходит', () => {
    const res = run(`Лист «История» прокручивается до конца\n\n${TRAILERS}\n`);
    expect(res.status).toBe(0);
    expect(res.stderr).toBe('');
  });

  it('заголовок с телом — красный и говорит, куда нести детали', () => {
    const res = run(`Починка\n\nПочему так.\nИ ещё строка.\n\n${TRAILERS}\n`);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('тело коммита (2 строк)');
    expect(res.stderr).toContain('описании PR');
  });

  it('тело, переодетое в трейлеры, упирается в их лимит', () => {
    const fake = Array.from(
      { length: 5 },
      (_, i) => `Note-${'abcde'[i]}: текст`,
    ).join('\n');
    const res = run(`Починка\n\n${fake}\n`);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('трейлеров больше');
  });

  it('длина заголовка считается в знаках, а не в байтах', () => {
    expect(run('ж'.repeat(120) + '\n').status).toBe(0);
    const long = run('ж'.repeat(121) + '\n');
    expect(long.status).toBe(1);
    expect(long.stderr).toContain('121 знаков');
  });

  it('сообщения, которые пишет сам git, проходят с телом', () => {
    expect(
      run("Merge remote-tracking branch 'origin/main'\n\n# Conflicts:\nтекст\n")
        .status,
    ).toBe(0);
    expect(run('Revert "Починка"\n\nThis reverts commit abc.\n').status).toBe(
      0,
    );
  });

  it('комментарии git и дифф под ножницами телом не считаются', () => {
    const scissors = `# ${'-'.repeat(24)} >8 ${'-'.repeat(24)}`;
    const res = run(
      `Починка\n# подсказка git\n${scissors}\ndiff --git a/x b/x\n+строка\n`,
    );
    expect(res.status).toBe(0);
  });

  it('настоящий git commit идёт через хук', () => {
    const git = (...args: string[]) =>
      spawnSync('git', args, { cwd: tmp, encoding: 'utf8' });
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    git('config', 'commit.gpgsign', 'false');
    mkdirSync(join(tmp, 'hooks'));
    copyFileSync(HOOK, join(tmp, 'hooks', 'commit-msg'));
    chmodSync(join(tmp, 'hooks', 'commit-msg'), 0o755);
    git('config', 'core.hooksPath', 'hooks');

    const withBody = git(
      'commit',
      '--allow-empty',
      '-m',
      'Починка',
      '-m',
      'Длинное объяснение',
    );
    expect(withBody.status).not.toBe(0);
    expect(withBody.stderr).toContain('commit-msg');
    expect(git('commit', '--allow-empty', '-m', 'Починка').status).toBe(0);
  });
});
