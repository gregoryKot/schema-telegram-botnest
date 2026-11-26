// Тест гейта check-filename-case.mjs. Инцидент 2026-11-05: `diagramEdges.ts`
// рядом с `DiagramEdges.tsx` — на macOS Vite резолвил `./DiagramEdges` в
// модель, кабинет терапевта падал в error boundary; на Linux-CI не видно.
//
// Файловая система macOS не даёт создать `foo.ts` и `FOO.ts` рядом, поэтому
// список путей подаётся файлом через `--list` (боевой путь — `git ls-files`).
// Проверяет ОБА исхода: красный на коллизии и зелёный на чистом дереве.
import { runGate } from './gate-sandbox';

const run = (paths: string[]) =>
  runGate(
    'check-filename-case.mjs',
    { 'list.txt': paths.join('\n') + '\n' },
    {
      args: ['--list', 'list.txt'],
    },
  );

describe('check-filename-case.mjs', () => {
  it('a/foo.ts + a/Foo.tsx — exit 1 (расширение разное, голый импорт всё равно коллидирует)', () => {
    const res = run(['a/foo.ts', 'a/Foo.tsx']);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('a/Foo.tsx');
    expect(res.stderr).toContain('a/foo.ts');
  });

  it('a/foo.ts + a/FOO.ts — exit 1', () => {
    expect(run(['a/foo.ts', 'a/FOO.ts']).status).toBe(1);
  });

  it('a/foo.ts + b/Foo.ts (разные каталоги) — exit 0', () => {
    const res = run(['a/foo.ts', 'b/Foo.ts']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓');
  });

  it('чистое дерево: модель рядом с компонентом и a.ts + a.css — exit 0', () => {
    expect(
      run(['a/DiagramEdges.tsx', 'a/diagramEdgesModel.ts', 'a/x.ts', 'a/x.css'])
        .status,
    ).toBe(0);
  });

  it('node_modules и schema-miniapp не смотрим', () => {
    expect(
      run([
        'node_modules/p/a.ts',
        'node_modules/p/A.ts',
        'schema-miniapp/a.ts',
        'schema-miniapp/A.ts',
      ]).status,
    ).toBe(0);
  });
});
