// Тест гейта check-legacy-name.mjs — старое название продукта «СхемаЛаб»
// не должно возвращаться в исходники фронтендов (issue: имя всплывало
// снова и снова после переезда на «Всё по схеме»).
import { runGate } from './gate-sandbox';

describe('check-legacy-name.mjs', () => {
  it('старое имя в webapp/src — exit 1 с файлом и строкой', () => {
    const res = runGate('check-legacy-name.mjs', {
      'webapp/src/pages/About.tsx': [
        'export const About = () => <p>Мы начинали как СхемаЛаб</p>;',
        '',
      ].join('\n'),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/pages/About.tsx:1');
  });

  it('старое имя в schema-miniapp/src (дефис/кириллица) — exit 1', () => {
    const res = runGate('check-legacy-name.mjs', {
      'schema-miniapp/src/share.ts':
        "export const text = 'Раньше — Схема-лаб';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('schema-miniapp/src/share.ts:1');
  });

  it('чистые исходники, включая легитимное "схема-терапия" — exit 0', () => {
    const res = runGate('check-legacy-name.mjs', {
      // "лаб" после "схема" не встречается — не должно ловиться регэксом,
      // хотя визуально похоже (проверяет, что фильтр не перебдел).
      'webapp/src/pages/About.tsx':
        'export const About = () => <p>Схема-терапия и дневник схем</p>;\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ Старого имени');
  });
});
