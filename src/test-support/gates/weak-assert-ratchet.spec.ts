// Тест гейта check-weak-assert-ratchet.mjs: слабый тест — expect() только на
// голые .toHaveBeenCalled()/.toHaveBeenCalledTimes(n), без проверки
// аргументов/результата, зелёный даже если хендлер вызвал мок с мусором.
// Скрипт читает список файлов через `git ls-files src` — песочница должна
// быть git-репозиторием.
import { runGate } from './gate-sandbox';

describe('check-weak-assert-ratchet.mjs', () => {
  it('новый weak-тест (голый toHaveBeenCalled) — рост счётчика, exit 1', () => {
    const res = runGate(
      'check-weak-assert-ratchet.mjs',
      {
        'scripts/weak-assert-baseline.json': JSON.stringify({ total: 0 }),
        'src/foo.spec.ts': [
          "it('calls something', () => {",
          '  expect(fn).toHaveBeenCalled();',
          '});',
          '',
        ].join('\n'),
      },
      { git: true },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('счётчик слабых тестов вырос 0 → 1');
    expect(res.stderr).toContain('src/foo.spec.ts: 1');
  });

  it('замена на toHaveBeenCalledWith(...) снижает счётчик — exit 0', () => {
    const res = runGate(
      'check-weak-assert-ratchet.mjs',
      {
        'scripts/weak-assert-baseline.json': JSON.stringify({ total: 1 }),
        'src/foo.spec.ts': [
          "it('calls something with args', () => {",
          "  expect(fn).toHaveBeenCalledWith('x');",
          '});',
          '',
        ].join('\n'),
      },
      { git: true },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('0 < 1 — стало лучше');
  });

  it('блок с ХОТЯ БЫ одним сильным ассертом — не weak, даже если рядом слабый', () => {
    // findWeakBlocks помечает блок weak только если ВСЕ expect() в нём слабые.
    // Тест ловит регресс, где кто-то упростил логику до "есть хоть один
    // toHaveBeenCalled" — это раздуло бы счётчик ложными срабатываниями.
    const res = runGate(
      'check-weak-assert-ratchet.mjs',
      {
        'scripts/weak-assert-baseline.json': JSON.stringify({ total: 0 }),
        'src/mixed.spec.ts': [
          "it('calls and checks result', () => {",
          '  expect(fn).toHaveBeenCalled();',
          "  expect(result).toBe('ok');",
          '});',
          '',
        ].join('\n'),
      },
      { git: true },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ weak-assert-храповик: 0 (без роста)');
  });
});
