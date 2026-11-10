// @vitest-environment jsdom
// ShareLink — один примитив тихой ссылки «Поделиться» (карточка схемы, строка режима справочника).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShareLink } from './ShareLink';

afterEach(cleanup);

describe('ShareLink', () => {
  it('кнопка со словом «Поделиться» зовёт onClick; aria-label называет, чем делятся', () => {
    const onClick = vi.fn();
    render(<ShareLink onClick={onClick} ariaLabel="Поделиться режимом «Уязвимый Ребёнок»" />);
    const btn = screen.getByRole('button', { name: 'Поделиться режимом «Уязвимый Ребёнок»' });
    expect(btn.textContent?.trim()).toBe('Поделиться');
    expect(btn.className).toBe('ds-link ss-share-link');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('без aria-label имя кнопки — само слово', () => {
    render(<ShareLink onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Поделиться' })).toBeTruthy();
  });
});
