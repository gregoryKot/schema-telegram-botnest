// Тест гейта check-address-agreement.mjs — согласование формы «вы»: мало
// заменить местоимение, вся фраза должна встать во множественное число
// («вы благодарен» → «вы благодарны»). Гейт жёсткий, без бейслайна.
import { runGate } from './gate-sandbox';
import { loadNamedPatterns } from './pattern-loader';

describe('check-address-agreement.mjs', () => {
  it('«вы» + краткое прилагательное в ед.ч. — exit 1', () => {
    const res = runGate('check-address-agreement.mjs', {
      'src/foo.ts':
        "export const msg = 'Помни, что вы благодарен себе за этот шаг';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('вы благодарен');
    expect(res.stderr).toContain('src/foo.ts:1');
  });

  it('«вы» + прошедшее время ед.ч. муж.рода без -л ("привык") — exit 1', () => {
    const res = runGate('check-address-agreement.mjs', {
      'webapp/src/needData.ts':
        "export const hint = 'узнайте, в чём вы привык себя ограничивать';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('вы привык');
  });

  it('корректно согласованный текст на «вы» — exit 0', () => {
    const res = runGate('check-address-agreement.mjs', {
      'src/foo.ts':
        "export const msg = 'Спасибо, что вы благодарны себе за этот шаг';\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ согласование «вы»: рассогласований нет');
  });

  // «вы сказал» (регулярное прошедшее на -л, без «бы») — до сверки 2026-08
  // этот паттерн проверялся только через «вы привык» (нерегулярная форма),
  // сам он покрыт не был.
  it('«вы» + регулярное прошедшее ед.ч. на -л ("вы сказал") — exit 1', () => {
    const res = runGate('check-address-agreement.mjs', {
      'src/foo.ts': "export const msg = 'Помни, что вы сказал ей правду';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('вы сказал');
  });

  // Комментарий со случайным «вы благодарен» — не user-facing текст, гейт
  // обязан молчать (иначе комментарии-примеры в исходниках роняли бы CI).
  it('«вы благодарен» внутри строчного комментария — не считается', () => {
    const res = runGate('check-address-agreement.mjs', {
      'src/foo.ts': [
        "// пример неправильного текста: 'вы благодарен'",
        "export const msg = 'вы благодарны';",
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(0);
  });

  // Без этого исключения тест самого гейта («вы благодарен» в фикстуре выше)
  // роняет гейт при сканировании реального дерева — см. комментарий в скрипте.
  it('.spec.ts / .test.ts не сканируются — фикстуры на гейт не роняют сами себя', () => {
    const res = runGate('check-address-agreement.mjs', {
      'src/foo.spec.ts':
        "export const msg = 'вы благодарен';\nit('x', () => msg);\n",
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ согласование «вы»: рассогласований нет');
  });
});

// Механизм вместо добросовестности (как check-gendered-forms.mjs): у КАЖДОГО
// паттерна PATTERNS обязан быть образец, который ловит именно он. Замер
// показал, что «past-regular» («вы сказал») выключался бесследно — оба
// существующих теста опирались на «past-irregular»/«short-adj».
describe('каждый паттерн PATTERNS пойман своим образцом', () => {
  const PATTERNS = loadNamedPatterns('check-address-agreement.mjs', 'PATTERNS');

  const POSITIVE: Record<string, string> = {
    'past-regular': 'вы сказал',
    'past-irregular': 'вы привык',
    'short-adj': 'вы благодарен',
  };

  it('в PATTERNS нет имени без образца в POSITIVE', () => {
    const missing = PATTERNS.map((p) => p.name).filter((n) => !(n in POSITIVE));
    expect(missing).toEqual([]);
  });

  it.each(PATTERNS.map((p) => [p.name] as const))(
    'паттерн «%s» ловит свой образец',
    (name) => {
      const p = PATTERNS.find((x) => x.name === name)!;
      const re = new RegExp(p.source, p.flags);
      expect(re.test(POSITIVE[name])).toBe(true);
    },
  );
});
