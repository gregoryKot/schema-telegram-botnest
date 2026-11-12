// @vitest-environment jsdom
// Лист «спасибо» (b28): солома 70, в полосе — сцена FinalCorners вместо знака (декор), h1, лид и одно
// главное действие — ссылка или кнопка. Лист — PaperOutcome, а не своя разметка (одна механика исхода).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThanksSheet } from './ThanksSheet';

afterEach(cleanup);

describe('ThanksSheet', () => {
  it('солома, сцена FinalCorners в полосе вместо знака, лист исхода', () => {
    const { container } = render(<ThanksSheet title="Спасибо" action={{ label: 'На главную', href: '/' }} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe('light-lock pa-outcome pa-thanks');
    expect(root.style.getPropertyValue('--h')).toBe('70');
    const band = root.querySelector('.pa-outcome-band')!;
    expect(band.getAttribute('aria-hidden')).toBe('true');
    expect(band.querySelectorAll('svg.pl2-final-corner--a, svg.pl2-final-corner--b')).toHaveLength(2);
    expect(band.querySelector('.scn-sign')).toBeNull();
  });

  it('надпись, h1, лид и главное действие-ссылка', () => {
    render(<ThanksSheet eyebrow="Подписка" title="Спасибо за поддержку!" lead="Подписка оформлена." action={{ label: 'На главную', href: '/' }} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Спасибо за поддержку!');
    expect(screen.getByText('Подписка')).toBeTruthy();
    expect(screen.getByText('Подписка оформлена.')).toBeTruthy();
    const a = screen.getByRole('link', { name: 'На главную' });
    expect(a.getAttribute('href')).toBe('/');
    expect(a.className).toContain('ds-btn ds-btn--lg');
  });

  it('главное действие-кнопка зовёт свой обработчик', () => {
    const onClick = vi.fn();
    render(<ThanksSheet title="Спасибо" action={{ label: 'Дальше', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
