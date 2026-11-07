// Тест гейта check-spelling.mjs — орфография строк, которые видит человек.
// Инцидент: QA 2026-11 нашёл «оффлайн» в карточке клиента терапевта на обеих
// площадках (плашка, вкладка добавления, имя карточки, фильтр списка), по
// словарю — «офлайн».
//
// Оба исхода (правило «Тестовые храповики и e2e»): гейт краснеет на видимой
// строке и молчит на чистом дереве. Каждое сужение области — комментарии,
// тесты, test-support — идёт в паре с контрольным образцом (правило №15):
// та же ошибка в видимой строке рядом обязана краснеть.
import { runGate } from './gate-sandbox';

const GATE = 'check-spelling.mjs';
const OK = '✓ орфография видимых строк';

describe('check-spelling.mjs', () => {
  it('JSX-текст «оффлайн» в webapp — exit 1 с файлом, строкой и верным написанием', () => {
    const res = runGate(GATE, {
      'webapp/src/a.tsx':
        'export const A = () => (\n  <span className="ds-badge">оффлайн</span>\n);\n',
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/a.tsx:2');
    expect(res.stderr).toContain('«офлайн»');
  });

  it('строковый литерал с заглавной в мини-аппе и в бэкенде — exit 1', () => {
    const res = runGate(GATE, {
      'webapp/src/b.tsx': "export const tabs = [['virtual', 'Оффлайн']];\n",
      'src/bot/c.ts': "export const t = 'ОФФЛАЙН-режим';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('webapp/src/b.tsx:1');
    expect(res.stderr).toContain('src/bot/c.ts:1');
  });

  it('shared и производное слово («оффлайновый») — exit 1', () => {
    const res = runGate(GATE, {
      'shared/src/d.ts': "export const s = 'оффлайновый клиент';\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('shared/src/d.ts:1');
  });

  it('комментарий не видит человек — exit 0; та же строка в коде рядом — exit 1', () => {
    const comment = [
      '// Оффлайн-очередь оценок: сеть упала — кладём в outbox.',
      '/** Статус: оффлайн-карточка без бота. */',
      'export const label = () => <p>{/* оффлайн */}офлайн</p>;',
      '',
    ].join('\n');
    const ok = runGate(GATE, { 'webapp/src/e.tsx': comment });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK);

    const bad = runGate(GATE, {
      'webapp/src/e.tsx': comment + "export const v = 'оффлайн';\n",
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('webapp/src/e.tsx:4');
  });

  it('тесты и test-support вне области — exit 0; тот же текст в исходнике — exit 1', () => {
    const fixture = "export const name = 'Оффлайн Иван';\n";
    const ok = runGate(GATE, {
      'src/therapy/x.spec.ts': fixture,
      'webapp/src/y.test.tsx': fixture,
      'src/test-support/z.ts': fixture,
    });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain(OK);

    const bad = runGate(GATE, { 'src/therapy/x.ts': fixture });
    expect(bad.status).toBe(1);
  });

  it('словарные «офлайн» и «онлайн» — exit 0', () => {
    const res = runGate(GATE, {
      'webapp/src/f.tsx':
        'export const F = () => <p>Офлайн-клиент: записи без бота. Встреча онлайн.</p>;\n',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(OK);
  });
});
