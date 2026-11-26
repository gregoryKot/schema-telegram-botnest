// Тест гейта check-unwatched-code.mjs: список `git ls-files` длиннее 1 МиБ.
// 2026-11-05: у владельца в корне лежал остаток `schema-miniapp/node_modules`
// (13 099 неотслеживаемых файлов); `precheck` стейджит неотслеживаемое в чистом
// дереве, вывод `git ls-files` превысил дефолтный maxBuffer execFileSync (1 МиБ),
// и гейт падал с ENOBUFS и стектрейсом вместо вердикта. Здесь — тот же объём
// путей внутри наблюдаемого дерева `src/` (гейт их не проверяет, поэтому
// единственный способ покраснеть — упасть на чтении списка).
import { runGate } from './gate-sandbox';

const SELF_BASELINE = {
  'scripts/check-unwatched-code.mjs':
    'копия проверяемого скрипта в песочнице теста',
};

// ~410 байт на путь × 2800 путей ≈ 1,1 МиБ вывода `git ls-files`.
function bigWatchedTree(): Record<string, string> {
  const dir = 'd'.repeat(200);
  const stem = 'f'.repeat(195);
  const files: Record<string, string> = {};
  for (let i = 0; i < 2800; i++) {
    files[`src/${dir}/${stem}${String(i).padStart(5, '0')}.ts`] = '';
  }
  return files;
}

describe('check-unwatched-code.mjs: длинный git ls-files', () => {
  it('список путей длиннее 1 МиБ — гейт отвечает вердиктом, а не ENOBUFS', () => {
    const res = runGate(
      'check-unwatched-code.mjs',
      {
        'scripts/unwatched-code-baseline.json': JSON.stringify(SELF_BASELINE),
        ...bigWatchedTree(),
      },
      { git: true },
    );
    expect(res.stderr).not.toContain('ENOBUFS');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('все под тестом');
  });
});
