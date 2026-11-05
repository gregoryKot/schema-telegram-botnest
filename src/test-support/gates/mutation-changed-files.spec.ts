// Селектор scripts/mutation-changed-files.mjs: какие из изменённых файлов
// мутировать в PR-CI. Не гейт, но от него зависит, что PR-CI проверит.
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runGate } from './gate-sandbox';

const config = JSON.stringify({ mutate: ['src/a.ts', 'src/b.ts'] });
const files = {
  'stryker.x.config.json': config,
  'src/a.ts': '',
  'src/b.ts': '',
};
const cfg = '--config=stryker.x.config.json';

describe('mutation-changed-files.mjs', () => {
  it('пересечение: только файлы из mutate', () => {
    const res = runGate('mutation-changed-files.mjs', files, {
      args: [cfg, 'src/b.ts', 'src/z.ts', 'README.md'],
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('src/b.ts');
  });

  it('несколько файлов — через запятую', () => {
    const res = runGate('mutation-changed-files.mjs', files, {
      args: [cfg, 'src/a.ts', 'src/b.ts'],
    });
    expect(res.stdout).toBe('src/a.ts,src/b.ts');
  });

  it('нет пересечения — пустой вывод (джоба зеленеет сразу)', () => {
    const res = runGate('mutation-changed-files.mjs', files, {
      args: [cfg, 'src/z.ts'],
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });

  it('удалённый файл (нет на диске) отбрасывается', () => {
    const res = runGate(
      'mutation-changed-files.mjs',
      { 'stryker.x.config.json': config, 'src/a.ts': '' },
      { args: [cfg, 'src/a.ts', 'src/b.ts'] },
    );
    expect(res.stdout).toBe('src/a.ts');
  });

  // ci.yml зовёт селектор однострочным шагом с --github-output: так вызов
  // разбирает precheck (agent-precheck.spec.ts), а выход шага пишет сам скрипт.
  describe('--github-output', () => {
    let dir: string;
    let out: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'gh-output-'));
      out = join(dir, 'output');
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));
    const env = () => ({ PATH: process.env.PATH ?? '', GITHUB_OUTPUT: out });

    it('дописывает «имя=список» в $GITHUB_OUTPUT', () => {
      const res = runGate('mutation-changed-files.mjs', files, {
        args: [cfg, '--github-output=files', 'src/a.ts', 'src/z.ts'],
        env: env(),
      });
      expect(res.status).toBe(0);
      expect(readFileSync(out, 'utf8')).toBe('files=src/a.ts\n');
    });

    it('пусто — «имя=» без списка, шаги мутаций пропустятся', () => {
      const res = runGate('mutation-changed-files.mjs', files, {
        args: [cfg, '--github-output=files', 'README.md'],
        env: env(),
      });
      expect(res.status).toBe(0);
      expect(readFileSync(out, 'utf8')).toBe('files=\n');
    });

    it('без $GITHUB_OUTPUT — код 2, а не тихий пустой выход', () => {
      const res = runGate('mutation-changed-files.mjs', files, {
        args: [cfg, '--github-output=files', 'src/a.ts'],
        env: { PATH: process.env.PATH ?? '' },
      });
      expect(res.status).toBe(2);
      expect(res.stderr).toContain('GITHUB_OUTPUT');
    });
  });
});
