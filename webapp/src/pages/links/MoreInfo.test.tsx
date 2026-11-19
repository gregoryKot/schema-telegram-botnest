// @vitest-environment jsdom
// «?» у пунктов страницы ссылок: тап раскрывает абзац под названием, повторный закрывает;
// кнопка — не внутри ссылки и ссылается на абзац через aria-controls.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinksPage } from './LinksPage';
import { LINKS } from './linksData';

vi.mock('../../api', () => ({ api: { trackPublicEvent: vi.fn() } }));

const withMore = LINKS.filter((l) => l.more);

describe('MoreInfo на странице ссылок', () => {
  it('«?» есть у проекта, канала о схема-терапии и «Здорового Взрослого»', () => {
    expect(withMore.map((l) => l.title)).toEqual(['Всё по схеме', 'Канал о схема-терапии', 'Здоровый Взрослый']);
  });

  it.each(withMore.map((l) => [l.title, l.more!] as const))('«%s»: тап открывает, повторный закрывает', (_t, more) => {
    const { container } = render(<LinksPage />);
    const btn = screen.getByRole('button', { name: `Подробнее о ${more.about}` });
    const body = document.getElementById(btn.getAttribute('aria-controls')!)!;
    expect(btn.closest('a')).toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(body.hidden).toBe(true);
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(body.hidden).toBe(false);
    expect(body.textContent).toContain(more.text);
    for (const q of more.quotes ?? []) expect(body.textContent).toContain(q);
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(body.hidden).toBe(true);
    expect(container.querySelector('a button')).toBeNull();
  });
});
