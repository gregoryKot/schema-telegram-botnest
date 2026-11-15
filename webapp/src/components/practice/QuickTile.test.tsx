// @vitest-environment jsdom
// QuickTile — одна плитка на квадраты «Здесь и сейчас» (со счётчиком) и «Что поможет» экрана паттерна (plain):
// вид формы держат классы, весь лист — тап-цель; раскладку jsdom не считает, размер зоны — по исходникам CSS.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuickTile } from './QuickTile';
import { QUICK_LOOK } from './quickLook';
import { glue } from '../../../../shared/src/utils/typo';
import { readCss } from '../../styles/cssRules.test-helpers';

afterEach(cleanup);

const LOOK = QUICK_LOOK.grounding;
const TITLE = 'Заземление 5-4-3-2-1';
const parts = (tile: Element) => [...tile.children].map((c) => c.className);

describe('QuickTile — квадрат со счётчиком', () => {
  it('квадрат бумаги практики: название, «зачем», знак с тенью-вырезкой, мета из данных и стрелка', () => {
    const onClick = vi.fn();
    render(<QuickTile look={LOOK} title={TITLE} text="вернуться в тело и в комнату" meta="прошли 3 раза" onClick={onClick} />);
    const tile = screen.getByRole('button');
    expect(tile.className).toBe('pp-paper pp-square cp-sq');
    expect(tile.style.getPropertyValue('--h')).toBe(String(LOOK.hue));
    expect(parts(tile)).toEqual(['pp-title', 'pp-text', 'cp-sq-art', 'pp-square-foot']);
    expect(tile.querySelector('.pp-title')!.textContent).toBe(glue(TITLE));
    expect(tile.querySelector('.cp-sq-art .scn-sign')).not.toBeNull();
    expect(tile.querySelector('.pp-meta')!.textContent).toBe(glue('прошли 3 раза'));
    fireEvent.click(tile);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('счётчик грузится — плашка-скелетон; не пришёл — мета пустая, без выдуманного числа', () => {
    const { container, rerender } = render(<QuickTile look={LOOK} title={TITLE} text="т" meta={undefined} onClick={vi.fn()} />);
    expect(container.querySelector('.pp-meta--skeleton')).not.toBeNull();
    rerender(<QuickTile look={LOOK} title={TITLE} text="т" meta={null} onClick={vi.fn()} />);
    expect(container.querySelector('.pp-meta--skeleton')).toBeNull();
    expect(container.querySelector('.pp-meta')!.textContent).toBe('');
  });
});

describe('QuickTile plain — без счётчика', () => {
  it('плитка ряда: название, «зачем» и знак практики; ни меты, ни стрелки', () => {
    const onClick = vi.fn();
    render(<QuickTile plain look={LOOK} title={TITLE} text="Пять чувств по очереди" onClick={onClick} />);
    const tile = screen.getByRole('button');
    expect(tile.className).toBe('pp-paper ps-practice');
    expect(tile.style.getPropertyValue('--h')).toBe(String(LOOK.hue));
    expect(parts(tile)).toEqual(['ps-practice-title', 'ps-practice-sub', 'ps-practice-sign']);
    expect(tile.querySelector('.ps-practice-sign svg')).not.toBeNull();
    expect(tile.querySelector('.pp-square-foot, .pp-meta, .pp-arrow')).toBeNull();
    fireEvent.click(tile);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('QuickTile — тап-цель', () => {
  it.each([
    ['квадрат', <QuickTile key="s" look={LOOK} title={TITLE} text="т" meta="прошли 2 раза" onClick={vi.fn()} />],
    ['plain', <QuickTile key="p" plain look={LOOK} title={TITLE} text="т" onClick={vi.fn()} />],
  ])('%s: весь лист — одна кнопка, знак и стрелка — украшение', (_, ui) => {
    const { container } = render(ui);
    const tile = screen.getByRole('button');
    expect(tile.getAttribute('type')).toBe('button');
    expect(container.querySelectorAll('button, a, [role="button"], [tabindex]')).toHaveLength(1);
    expect([...tile.querySelectorAll('.cp-sq-art, .ps-practice-sign, .pp-arrow')].every((n) => n.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('зона не меньше 44: высота плитки ряда и ширина знака в листе — во всех медиа и контейнерах', () => {
    const px = (file: string, sel: RegExp, prop: string) => readCss(file)
      .filter((r) => r.selectors.some((s) => sel.test(s)))
      .flatMap((r) => [...r.body.matchAll(new RegExp(`(?:^|[;\\s])${prop}:\\s*(\\d+)px`, 'g'))].map((m) => Number(m[1])));
    const sizes = [
      px('pattern-sheet.css', /\.ps-practice$/, 'min-height'),
      px('pattern-sheet.css', /\.ps-practice-sign$/, 'width'),
      px('client-practice.css', /\.cp-sq-art$/, 'width'),
    ];
    for (const s of sizes) {
      expect(s.length).toBeGreaterThan(0);
      expect(Math.min(...s)).toBeGreaterThanOrEqual(44);
    }
  });
});
