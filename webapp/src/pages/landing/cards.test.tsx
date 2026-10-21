// @vitest-environment jsdom
// cards.tsx (лендинг визитки): FaqList — аккордеон, доступный скринридеру
// (aria-expanded/aria-controls, свёрнутая панель — aria-hidden + inert);
// BentoCard — не кликабельная карточка, поэтому без hover-наклона (ложный
// аффорданс), а цвет текста на акцентной заливке — токен --on-accent.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BentoCard, FaqList } from './cards';
import { FAQ_ITEMS } from './constants';

afterEach(() => cleanup());

describe('FaqList', () => {
  it('свёрнут: aria-expanded=false, панель скрыта от a11y-дерева и не фокусируется', () => {
    render(<FaqList price="5 000 ₽" />);
    const button = screen.getByRole('button', { name: new RegExp(FAQ_ITEMS[0].q) });
    expect(button.getAttribute('aria-expanded')).toBe('false');

    const panel = document.getElementById(button.getAttribute('aria-controls') as string);
    expect(panel).toBeTruthy();
    expect(panel?.getAttribute('aria-hidden')).toBe('true');
    expect(panel?.hasAttribute('inert')).toBe(true);
    // Скрытый ответ не попадает в доступное дерево.
    expect(screen.queryByRole('paragraph')).toBeNull();
  });

  it('клик раскрывает панель; повторный клик сворачивает', () => {
    render(<FaqList price="5 000 ₽" />);
    const button = screen.getByRole('button', { name: new RegExp(FAQ_ITEMS[0].q) });
    const panel = () => document.getElementById(button.getAttribute('aria-controls') as string);

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel()?.getAttribute('aria-hidden')).toBe('false');
    expect(panel()?.hasAttribute('inert')).toBe(false);
    expect(screen.getAllByRole('paragraph')).toHaveLength(1);

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(panel()?.hasAttribute('inert')).toBe(true);
  });

  it('открыт всегда один пункт, у каждой панели свой id', () => {
    render(<FaqList price="5 000 ₽" />);
    const buttons = screen.getAllByRole('button');
    const ids = buttons.map((b) => b.getAttribute('aria-controls'));
    expect(new Set(ids).size).toBe(FAQ_ITEMS.length);

    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
  });
});

describe('BentoCard', () => {
  it('не наклоняется при наведении: карточка не кликается, аффорданса быть не должно', () => {
    const { container } = render(<BentoCard num="01" title="Заголовок" text="Текст" />);
    const card = container.firstChild as HTMLElement;
    fireEvent.mouseMove(card, { clientX: 5, clientY: 5 });
    expect(card.style.transform).toBe('');
  });

  it('на акцентной заливке текст — var(--on-accent), а не захардкоженный белый', () => {
    const { container } = render(<BentoCard num="01" title="Заголовок" text="Текст" accent />);
    expect((container.firstChild as HTMLElement).style.color).toBe('var(--on-accent)');
    expect(screen.getByText('Текст').style.color).toBe('var(--on-accent)');
  });
});
