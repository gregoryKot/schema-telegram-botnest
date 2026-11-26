// @vitest-environment jsdom
// «Выраженные схемы»: знак домена — у первой строки серии одного домена, у продолжения серии — тихий штрих тоном
// домена, а не пустое гнездо (ревью g5 r3: пустые гнёзда 44px читались недостающей картинкой).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { ExpressedCard } from './ExpressedCard';

afterEach(cleanup);

const [d0, d1] = SCHEMA_DOMAINS;
const [a, b, c] = d0.schemas;
const [x] = d1.schemas;
// Порядок по баллу: a, b (тот же домен — серия), x (другой домен), c (снова первый домен — новая серия).
const scores = { [a.id]: { avg: 5.2, pct5plus: 50 }, [b.id]: { avg: 4.8, pct5plus: 40 }, [x.id]: { avg: 4.4, pct5plus: 30 }, [c.id]: { avg: 4, pct5plus: 20 } };

function rows() {
  render(<ExpressedCard loading={false} ysqSchemaIds={[c.id, x.id, b.id, a.id]} ysqScores={scores} completedAt={null} onOpenSchema={vi.fn()} />);
  return [...document.querySelectorAll<HTMLElement>('.cs-bar-row')];
}

describe('ExpressedCard — знак серии и связка', () => {
  it('первая строка серии — знак домена; продолжение — штрих связки без знака; новая серия — снова знак', () => {
    const list = rows();
    expect(list.map((r) => r.querySelector('.cs-bar-sign svg') !== null)).toEqual([true, false, true, true]);
    expect(list.map((r) => r.querySelector('.cs-bar-run') !== null)).toEqual([false, true, false, false]);
    expect(list[1].querySelector('.cs-bar-sign')!.className).toContain('cs-bar-sign--run');
  });

  it('порядок строк — по баллу, а связка стоит у строки того же домена, что строка над ней', () => {
    const names = rows().map((r) => r.querySelector('.cs-bar-name')!.textContent);
    expect(names).toEqual([a.name, b.name, x.name, c.name]);
  });

  it('пока грузится — силуэт строк, без пустой карточки-заглушки', () => {
    const { container } = render(<ExpressedCard loading ysqSchemaIds={[]} ysqScores={{}} completedAt={null} onOpenSchema={vi.fn()} />);
    expect(container.querySelectorAll('.cs-bar-row')).toHaveLength(0);
    expect(container.querySelector('.pp-empty')).toBeNull();
    expect(screen.getByText('Твои выраженные схемы')).toBeTruthy();
  });
});
