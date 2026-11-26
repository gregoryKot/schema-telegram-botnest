// @vitest-environment jsdom
// Раскрывашки примеров колеса детства — шеврон ds-fold-chev, который переворачивает
// aria-expanded, а не глифы ▴/▾ текстом (docs/open/frontend-ux.md, хвост #906).
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NeedExamples } from './NeedExamples';
import { CHILDHOOD_EXAMPLES } from '../../../../../shared/src/childhoodWheel/childhoodExamples';

const chev = (el: HTMLElement) => el.querySelector('.ds-fold-chev');

describe('NeedExamples — раскрывашки', () => {
  it('список примеров: шеврон ds-fold-chev, aria-expanded меняется, глифов текстом нет', () => {
    const { container } = render(<NeedExamples needId="attachment" />);
    const toggle = screen.getByRole('button', { name: /Примеры/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(chev(toggle)?.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).not.toMatch(/[▴▾]/);
  });

  it('пример — ds-fold-btn с шевроном; тап раскрывает историю', () => {
    render(<NeedExamples needId="attachment" />);
    fireEvent.click(screen.getByRole('button', { name: /Примеры/ }));
    const first = CHILDHOOD_EXAMPLES.attachment[0];
    const head = screen.getByRole('button', { name: `≈${first.score}/10` });
    expect(head.classList.contains('ds-fold-btn')).toBe(true);
    expect(chev(head)?.getAttribute('aria-hidden')).toBe('true');
    expect(head.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(first.text)).toBeTruthy();
  });

  it('открыт один пример; закрытие списка сбрасывает выбор', () => {
    render(<NeedExamples needId="attachment" />);
    const toggle = screen.getByRole('button', { name: /Примеры/ });
    fireEvent.click(toggle);
    const [a, b] = CHILDHOOD_EXAMPLES.attachment;
    const headA = () => screen.getByRole('button', { name: `≈${a.score}/10` });
    const headB = () => screen.getByRole('button', { name: `≈${b.score}/10` });
    fireEvent.click(headA());
    fireEvent.click(headB());
    expect(headA().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(a.text)).toBeNull();
    expect(screen.getByText(b.text)).toBeTruthy();
    fireEvent.click(headB());
    expect(screen.queryByText(b.text)).toBeNull();
    fireEvent.click(headB());
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: `≈${b.score}/10` })).toBeNull();
    fireEvent.click(toggle);
    expect(headB().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(b.text)).toBeNull();
  });
});
