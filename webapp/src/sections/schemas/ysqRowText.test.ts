import { describe, it, expect } from 'vitest';
import { ysqRowText } from './ysqRowText';

const tr = (ty: string, vy: string) => (vy ? ty : vy);
const trVy = (_ty: string, vy: string) => vy;

describe('ysqRowText', () => {
  it('незаконченный тест приоритетнее результата', () => {
    expect(ysqRowText(40, '2026-10-08T10:00:00Z', tr)).toEqual({ sub: 'Начат · отвечено 40 из 116', action: 'Продолжить', primary: true });
  });
  it('пройден — «Результаты» второстепенной кнопкой, дата без сдвига зоны', () => {
    const r = ysqRowText(null, '2026-10-08T10:00:00Z', tr);
    expect(r).toMatchObject({ action: 'Результаты', primary: false });
    expect(r.sub).toContain('8 окт');
  });
  it('не начат — «Начать», форма обращения берётся из tr', () => {
    expect(ysqRowText(null, null, tr).sub).toContain('Определи ');
    expect(ysqRowText(null, null, trVy)).toMatchObject({ action: 'Начать', primary: true });
    expect(ysqRowText(null, null, trVy).sub).toContain('Определите');
  });
});
