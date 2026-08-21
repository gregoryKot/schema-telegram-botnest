// Тест гейта check-bundle-size-ratchet.mjs (аудит 2026-07, пункт №5: байт-
// храповик размера бандлов). Сборка webapp уже печатала «chunks larger than
// 400 kB» в лог успешного билда — и это молча игнорировалось, у гейта не
// было ни одного теста. Песочница подсовывает фикстурные dist-каталоги
// вместо настоящей сборки (как file-size-ratchet.spec.ts подсовывает
// fixture-исходники вместо реального дерева) — скрипт не знает, что каталоги
// не настоящие, он просто читает байты файлов по путям.
import { readFileSync } from 'fs';
import { runGate, cleanupTmp } from './gate-sandbox';

/** Строка ровно `n` байт (ascii — 1 символ = 1 байт) для fixture-JS-файла. */
const bytes = (n: number) => 'x'.repeat(n);

const BASELINE = {
  'webapp:total-js': 100_000,
  'webapp:largest-chunk': 90_000,
  'miniapp:index.js': 50_000,
  'miniapp:total-js': 50_000,
};

/** Фикстурное дерево, ровно повторяющее бейслайн (a.js — самый тяжёлый
 * webapp-чанк, b.js добирает total-js; miniapp — один index.js). */
function matchingFiles() {
  return {
    'scripts/bundle-size-baseline.json': JSON.stringify(BASELINE),
    'webapp/dist/assets/a.js': bytes(90_000),
    'webapp/dist/assets/b.js': bytes(10_000),
    'schema-miniapp/dist/assets/index.js': bytes(50_000),
  };
}

describe('check-bundle-size-ratchet.mjs', () => {
  it('total-js вырос сверх допуска — exit 1 с "было → стало"', () => {
    const res = runGate('check-bundle-size-ratchet.mjs', {
      ...matchingFiles(),
      // largest-chunk остаётся 90 000 (совпадает с бейслайном), но b.js
      // тяжелее на 1600 байт — total-js растёт на 1600, больше допуска 512.
      'webapp/dist/assets/b.js': bytes(11_600),
    });

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp:total-js');
    expect(res.stderr).toContain('вырос сверх зафиксированного размера');
    expect(res.stderr).toContain('--update');
    // largest-chunk не изменился — не должен попасть в список выросших.
    expect(res.stderr).not.toContain('webapp:largest-chunk:');
  });

  it('largest-chunk вырос — exit 1 называет именно этот ключ', () => {
    const res = runGate('check-bundle-size-ratchet.mjs', {
      ...matchingFiles(),
      // a.js — самый тяжёлый чанк, увеличиваем и его, и общий total вместе.
      'webapp/dist/assets/a.js': bytes(91_000),
      'webapp/dist/assets/b.js': bytes(10_600),
    });

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp:largest-chunk');
  });

  it('рост ровно на допуск (512 байт) не считается ростом', () => {
    const res = runGate('check-bundle-size-ratchet.mjs', {
      ...matchingFiles(),
      'webapp/dist/assets/b.js': bytes(10_000 + 512), // +512, не больше
    });

    expect(res.status).toBe(0);
  });

  it('бандл не вырос — exit 0, "без роста"', () => {
    const res = runGate('check-bundle-size-ratchet.mjs', matchingFiles());

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ бандл-храповик: без роста');
  });

  it('бандл уменьшился — exit 0 и предложение зафиксировать прогресс', () => {
    const res = runGate('check-bundle-size-ratchet.mjs', {
      ...matchingFiles(),
      'webapp/dist/assets/b.js': bytes(8_000), // total-js меньше на 2000
    });

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('уменьшились');
    expect(res.stdout).toContain('--update');
  });

  it('нет webapp/dist — exit 1 с подсказкой "сначала собери"', () => {
    const res = runGate('check-bundle-size-ratchet.mjs', {
      'scripts/bundle-size-baseline.json': JSON.stringify(BASELINE),
      'schema-miniapp/dist/assets/index.js': bytes(50_000),
    });

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/dist не собран');
    expect(res.stderr).toContain('Сначала собери');
  });

  it('есть schema-miniapp/dist/assets, но без index.js — exit 1', () => {
    const res = runGate('check-bundle-size-ratchet.mjs', {
      'scripts/bundle-size-baseline.json': JSON.stringify(BASELINE),
      'webapp/dist/assets/a.js': bytes(90_000),
      'webapp/dist/assets/b.js': bytes(10_000),
      // имя с хешем вместо ожидаемого index.js без хеша (правило №13).
      'schema-miniapp/dist/assets/index-ABC123.js': bytes(50_000),
    });

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('index.js');
    expect(res.stderr).toContain('не найден');
  });

  it('нет schema-miniapp/dist вовсе — exit 1', () => {
    const res = runGate('check-bundle-size-ratchet.mjs', {
      'scripts/bundle-size-baseline.json': JSON.stringify(BASELINE),
      'webapp/dist/assets/a.js': bytes(90_000),
      'webapp/dist/assets/b.js': bytes(10_000),
    });

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('schema-miniapp/dist/assets не найден');
  });

  it('нет бейслайна — гейт падает, а не молчит', () => {
    const res = runGate('check-bundle-size-ratchet.mjs', {
      'webapp/dist/assets/a.js': bytes(90_000),
      'webapp/dist/assets/b.js': bytes(10_000),
      'schema-miniapp/dist/assets/index.js': bytes(50_000),
    });

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Нет бейслайна');
  });

  it('--update фиксирует текущие байты по всем четырём ключам', () => {
    const res = runGate(
      'check-bundle-size-ratchet.mjs',
      {
        'webapp/dist/assets/a.js': bytes(90_000),
        'webapp/dist/assets/b.js': bytes(10_000),
        'schema-miniapp/dist/assets/index.js': bytes(50_000),
      },
      { args: ['--update'], keepTmp: true },
    );

    try {
      expect(res.status).toBe(0);
      const written = JSON.parse(
        readFileSync(`${res.tmp}/scripts/bundle-size-baseline.json`, 'utf8'),
      ) as Record<string, number>;
      expect(written['webapp:total-js']).toBe(100_000);
      expect(written['webapp:largest-chunk']).toBe(90_000);
      expect(written['miniapp:index.js']).toBe(50_000);
      expect(written['miniapp:total-js']).toBe(50_000);
    } finally {
      cleanupTmp(res.tmp);
    }
  });
});
