// Тест гейта check-address-agreement.mjs — согласование формы «вы»: мало
// заменить местоимение, вся фраза должна встать во множественное число
// («вы благодарен» → «вы благодарны»). Гейт жёсткий, без бейслайна.
import { runGate } from './gate-sandbox';

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
});
