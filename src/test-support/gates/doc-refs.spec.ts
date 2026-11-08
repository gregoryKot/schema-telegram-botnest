// Тест гейта check-doc-refs.mjs: путь в обратных кавычках в CLAUDE.md,
// docs/SECURITY.md, docs/README.md и .claude/rules/*.md существует в дереве.
// Образец промаха — SECURITY.md называл `src/therapy/therapy.service.ts`,
// которого нет с переезда assertRelation в therapy-relations.service.ts.
import { spawnSync } from 'child_process';
import { join } from 'path';
import { runGate } from './gate-sandbox';

const ROOT = join(__dirname, '..', '..', '..');
const TREE = {
  'src/infra/real.service.ts': 'export {};\n',
  'scripts/check-x.mjs': '\n',
};
const run = (docs: Record<string, string>, baseline?: Record<string, string>) =>
  runGate('check-doc-refs.mjs', {
    ...TREE,
    ...docs,
    ...(baseline
      ? { 'scripts/doc-refs-baseline.json': JSON.stringify(baseline) }
      : {}),
  });

describe('check-doc-refs.mjs', () => {
  it('настоящие документы — зелёный', () => {
    const res = spawnSync('node', ['scripts/check-doc-refs.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('несуществующий путь — красный, с файлом и строкой', () => {
    const res = run({
      'CLAUDE.md': '# x\n\nСм. `src/infra/gone.service.ts`.\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('CLAUDE.md:3: `src/infra/gone.service.ts`');
  });

  it('существующий путь, каталог, хвосты :12, ::метод, #якорь — зелёный', () => {
    const doc = [
      '`src/infra/real.service.ts`, `src/infra/`, `src/infra/real.service.ts:12-40`,',
      '`src/infra/real.service.ts::tick`, `scripts/check-x.mjs#шапка`, `package.json`.',
    ].join('\n');
    const res = run({ 'docs/README.md': doc, 'package.json': '{}' });
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('маски, команды, голые имена и блок кода не сверяются', () => {
    const doc = [
      '`src/**/*.ts`, `src/<модуль>/`, `npm ci --silent`, `gone.ts`, `https://x/y`.',
      '```bash',
      'node src/infra/gone.mjs',
      '`src/infra/gone-in-fence.ts`',
      '```',
    ].join('\n');
    expect(run({ 'docs/SECURITY.md': doc }).status).toBe(0);
  });

  it('контроль: тот же путь вне блока кода и в правиле .claude/rules — красный', () => {
    const res = run({
      '.claude/rules/x.md': 'Образец — `src/infra/gone-in-fence.ts`.\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('.claude/rules/x.md:1');
  });

  it('бейслайн гасит нарочно несуществующий путь; протухшая и короткая причина — красный', () => {
    const doc = {
      'CLAUDE.md': '`src/infra/dist/` не хранится в репозитории.\n',
    };
    const key = 'CLAUDE.md::src/infra/dist/';
    expect(
      run(doc, { [key]: 'каталог сборки нарочно не в репозитории' }).status,
    ).toBe(0);
    expect(run(doc, { [key]: 'сборка' }).stderr).toContain(
      'причина короче 20 символов',
    );
    const stale = run(
      { 'CLAUDE.md': '`src/infra/real.service.ts`\n' },
      {
        'CLAUDE.md::src/infra/real.service.ts': 'был удалён, теперь снова есть',
      },
    );
    expect(stale.stderr).toContain('запись протухла');
  });
});
