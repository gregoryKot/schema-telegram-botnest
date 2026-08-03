// Тест самого гейта check-mutation-ratchet.mjs (правило CLAUDE.md "правило
// без гейта не работает" — этот гейт защищает mutation-score золотых зон:
// шифрование/auth/платёжи. Сломанный гейт молча пропустит выживших мутантов.
//
// Формат отчёта stryker (report.files[path].mutants[].status) и baseline
// воспроизведены как fixture-JSON — сам Stryker в песочнице не гоняем
// (дорого и не нужно: гейт — читатель готового отчёта, не раннер).
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate, cleanupTmp } from './gate-sandbox';

// Stryker кладёт статус мутанта в это поле; гейт делит их на detected
// (Killed/Timeout), игнорируемые (CompileError/Ignored/RuntimeError) и
// "живые" (всё остальное, напр. Survived) — знаменатель не должен расти
// автоматически, включая недоступный статику.
function mutant(status: string) {
  return { status };
}

function report(files: Record<string, ReturnType<typeof mutant>[]>) {
  return JSON.stringify({
    files: Object.fromEntries(
      Object.entries(files).map(([f, mutants]) => [f, { mutants }]),
    ),
  });
}

describe('check-mutation-ratchet.mjs', () => {
  it('просадка счёта файла ниже пола (>допуска 1.5пп) — exit 1, файл в stderr', () => {
    const res = runGate('check-mutation-ratchet.mjs', {
      'scripts/mutation-baseline.json': JSON.stringify({
        total: 90,
        files: { 'src/a.ts': 90 },
      }),
      'reports/mutation/mutation.json': report({
        // 5 Killed / 5 Survived = 50% — просадка с 90% далеко за допуском.
        'src/a.ts': [
          ...Array(5).fill(mutant('Killed')),
          ...Array(5).fill(mutant('Survived')),
        ],
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/a.ts: 90% → 50%');
  });

  it('просадка В ПРЕДЕЛАХ допуска 1.5пп — exit 0 (не флакает на таймаут-шуме)', () => {
    const res = runGate('check-mutation-ratchet.mjs', {
      'scripts/mutation-baseline.json': JSON.stringify({
        total: 90,
        files: { 'src/a.ts': 90 },
      }),
      'reports/mutation/mutation.json': report({
        // 89 Killed / 11 Survived = 89.00% — просадка 1пп, меньше допуска 1.5.
        'src/a.ts': [
          ...Array(89).fill(mutant('Killed')),
          ...Array(11).fill(mutant('Survived')),
        ],
      }),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ mutation-храповик');
  });

  it('файл из бейслайна пропал из отчёта — exit 1', () => {
    const res = runGate('check-mutation-ratchet.mjs', {
      'scripts/mutation-baseline.json': JSON.stringify({
        total: 90,
        files: { 'src/a.ts': 90, 'src/gone.ts': 80 },
      }),
      'reports/mutation/mutation.json': report({
        'src/a.ts': [...Array(9).fill(mutant('Killed')), mutant('Survived')],
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('файл пропал из прогона: src/gone.ts');
  });

  it('новый файл в отчёте без пола в бейслайне, с низким счётом — exit 0 + предупреждение', () => {
    const res = runGate('check-mutation-ratchet.mjs', {
      'scripts/mutation-baseline.json': JSON.stringify({
        total: 90,
        files: { 'src/a.ts': 90 },
      }),
      'reports/mutation/mutation.json': report({
        'src/a.ts': [...Array(9).fill(mutant('Killed')), mutant('Survived')],
        // новый файл — не в бейслайне, мутанты почти все выжили.
        'src/new.ts': [mutant('Killed'), ...Array(9).fill(mutant('Survived'))],
      }),
    });
    // Общий счёт считается ТОЛЬКО по файлам бейслайна — новый низкий файл
    // не должен утянуть его вниз и уронить CI сам по себе.
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('зафиксируй --update');
    expect(res.stdout).toContain('src/new.ts');
  });

  it('нет отчёта reports/mutation/mutation.json — exit 1 (не должен молча зеленеть)', () => {
    const res = runGate('check-mutation-ratchet.mjs', {
      'scripts/mutation-baseline.json': JSON.stringify({
        total: 90,
        files: {},
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('нет отчёта');
  });

  it('CompileError/Ignored/RuntimeError не в знаменателе, Killed/Timeout — обезврежены', () => {
    // 6 мутантов: Killed+Timeout (detected=2), Survived (живой, valid),
    // CompileError/Ignored/RuntimeError (исключены из знаменателя). Если бы
    // гейт по ошибке считал их в знаменателе, pct был бы 2/6=33.33%, а не
    // 2/3=66.67% — бейслайн ниже поймал бы регресс классификации.
    const res = runGate('check-mutation-ratchet.mjs', {
      'scripts/mutation-baseline.json': JSON.stringify({
        total: 66.67,
        files: { 'src/c.ts': 66.67 },
      }),
      'reports/mutation/mutation.json': report({
        'src/c.ts': [
          mutant('Killed'),
          mutant('Timeout'),
          mutant('Survived'),
          mutant('CompileError'),
          mutant('Ignored'),
          mutant('RuntimeError'),
        ],
      }),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('66.67%');
    expect(res.stdout).toContain('обезврежено 2/3 мутантов');
  });

  it('--update перезаписывает scripts/mutation-baseline.json актуальными числами', () => {
    const res = runGate(
      'check-mutation-ratchet.mjs',
      {
        'reports/mutation/mutation.json': report({
          'src/a.ts': [
            ...Array(8).fill(mutant('Killed')),
            ...Array(2).fill(mutant('Survived')),
          ],
        }),
      },
      { args: ['--update'], keepTmp: true },
    );
    try {
      expect(res.status).toBe(0);
      const written = JSON.parse(
        readFileSync(
          join(res.tmp, 'scripts', 'mutation-baseline.json'),
          'utf8',
        ),
      ) as { total: number; files: Record<string, number> };
      expect(written.total).toBe(80);
      expect(written.files['src/a.ts']).toBe(80);
    } finally {
      cleanupTmp(res.tmp);
    }
  });
});
