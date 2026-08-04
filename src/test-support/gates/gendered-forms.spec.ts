// Тест гейта check-gendered-forms.mjs (свип 2026-08): пофайловый храповик
// мужского рода в текстах, обращённых к пользователю. Продукт по умолчанию
// говорит на «ты», а «ты сделал» / «позволь себе быть сильным» для половины
// читателей звучит как написанное не им.
//
// Проверяются оба исхода: гейт краснеет на регрессе И зеленеет на чистом
// дереве. Второй не менее важен — ложно-красный гейт отключают через неделю.
import { runGate } from './gate-sandbox';

describe('check-gendered-forms.mjs', () => {
  it('новый файл с «ты сделал» — exit 1', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': "export const msg = 'Ты сделал шаг навстречу себе';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/foo.ts: новый файл с 1 мужскими формами');
    expect(res.stderr).toContain('[ty-past] Ты сделал');
  });

  it('ловит краткое прилагательное «ты не обязан»', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': "export const msg = 'Ты не обязан быть в форме сегодня';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[ty-short-adj] Ты не обязан');
  });

  it('ловит скобочный костыль «сделал(а)»', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': "export const msg = 'Я обречён(а) быть в одиночестве';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[brackets] обречён(а)');
  });

  it('ловит «позволь себе быть сильным» (прилагательное про читателя)', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': "export const msg = 'Позволь себе не быть сильным';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[inf-adj-m] быть сильным');
  });

  it('ловит читателя, названного уменьшительным: «маленький я», «себе-маленькому»', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        "export const a = 'Дорогой маленький я,';",
        "export const b = 'Сказать себе-маленькому то, что нужно';",
        "export const c = 'нужна забота — как маленькому, которого не обнимали';",
        "export const d = 'Внутри — маленький и уязвимый, рядом никого';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('[child-self-m] маленький я');
    expect(res.stderr).toContain('[child-self-m] себе-маленькому');
  });

  it('«маленький» при существительном — законно, гейт молчит', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/foo.ts': [
        "export const a = 'Один маленький шаг — уже много';",
        "export const b = 'нужна забота — как ребёнку, которого не обнимали';",
        "export const c = 'Дорогой мой ребёнок,';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });

  it('рост счётчика в известном файле — exit 1 с «было → стало»', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({
        'src/known.ts': 1,
      }),
      'src/known.ts': [
        "export const a = 'Ты сделал первый шаг';",
        "export const b = 'Ты вернулся после перерыва';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/known.ts: 1 → 2');
  });

  it('снижение счётчика — exit 0, предлагает зафиксировать --update', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({
        'src/known.ts': 2,
      }),
      'src/known.ts': "export const a = 'Ты сделал первый шаг';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 < 2 — стало лучше');
  });

  // Ложно-красный гейт хуже отсутствующего: он заставляет коверкать язык.
  it('форма «вы» рода не имеет — не считается регрессом', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/clean.ts': "export const msg = 'Вы сделали шаг навстречу себе';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик мужского рода: 0 (без роста)');
  });

  it('нейтральная формулировка в настоящем времени — exit 0', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/clean.ts':
        "export const msg = 'Третий раз перечитываешь своё сообщение';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик мужского рода: 0 (без роста)');
  });

  // «психолог» кончается на «ог» — не прошедшее время; «живой человек» —
  // мужской род принадлежит слову «человек», а не читателю.
  it('мужской род у другого слова и существительные — не срабатывает', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      'src/clean.ts': [
        "export const a = 'Я психолог и работаю со схемами';",
        "export const b = 'Рядом живой человек, а не бот';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Храповик мужского рода: 0 (без роста)');
  });
});
