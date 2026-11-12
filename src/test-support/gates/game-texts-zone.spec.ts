// Каталог текстов игры (game/src/i18n/messages.ts) — в зоне трёх гейтов текста:
// раньше game/ был слепой зоной (правило №15). Образцы — реальные строки
// каталога до починки; контрольные — их исправленные версии.
import { runGate } from './gate-sandbox';

const FILE = 'game/src/i18n/messages.ts';
const catalog = (ru: string) =>
  `export const M = {\n  m_x: { ru: "${ru}", en: "x" },\n};\n`;

describe('тексты игры в зоне гейтов', () => {
  it.each([
    [
      'check-gendered-forms.mjs',
      'scripts/gendered-forms-baseline.json',
      '«Ты мог сделать лучше. Ты всегда так»',
      '«Можно было сделать лучше. Ты всегда так»',
    ],
    [
      'check-robot-phrases.mjs',
      'scripts/robot-phrases-baseline.json',
      'Прокрастинация — это не лень. Это избегание неприятного чувства.',
      'За прокрастинацией стоит избегание неприятного чувства.',
    ],
  ])(
    '%s: ловит образец, пропускает исправленный',
    (gate, baseline, bad, ok) => {
      const files = (ru: string) => ({
        [baseline]: JSON.stringify({}),
        [FILE]: catalog(ru),
      });
      const red = runGate(gate, files(bad));
      expect(red.status).toBe(1);
      expect(red.stderr).toContain(FILE);
      expect(runGate(gate, files(ok)).status).toBe(0);
    },
  );

  it('check-schema-terms.mjs: ловит запрещённый вариант, пропускает канон', () => {
    expect(
      runGate('check-schema-terms.mjs', {
        [FILE]: catalog('это — Карающий Родитель, чужой голос'),
      }).status,
    ).toBe(1);
    expect(
      runGate('check-schema-terms.mjs', {
        [FILE]: catalog('это — Карающий Критик, чужой голос'),
      }).status,
    ).toBe(0);
  });

  it('Мистер — персонаж, его мужской род гейт не трогает', () => {
    const res = runGate('check-gendered-forms.mjs', {
      'scripts/gendered-forms-baseline.json': JSON.stringify({}),
      [FILE]: catalog('Мистер дошёл за двадцать минут.'),
    });
    expect(res.status).toBe(0);
  });
});
