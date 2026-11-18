// @vitest-environment jsdom
// Страница ссылок: кнопки рисуются по массиву (пункт без адреса скрыт), клик шлёт
// links_page_click с кнопкой и источником из адреса страницы.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinksPage } from './LinksPage';
import { LINKS, readyLinks, type LinkItem } from './linksData';
import { api } from '../../api';

vi.mock('../../api', () => ({ api: { trackPublicEvent: vi.fn() } }));

// jsdom не умеет переходить по ссылке — сам переход здесь не проверяется.
const stopNavigation = (e: Event) => e.preventDefault();

beforeEach(() => {
  vi.mocked(api.trackPublicEvent).mockClear();
  document.addEventListener('click', stopNavigation);
});
afterEach(() => {
  document.removeEventListener('click', stopNavigation);
  window.history.replaceState({}, '', '/');
});

describe('readyLinks', () => {
  it('пункт без адреса не попадает в список', () => {
    const items: LinkItem[] = [
      { id: 'about', kind: 'plain', title: 'А', href: '/' },
      { id: 'channel_ha', kind: 'plain', title: 'Б', href: null },
    ];
    expect(readyLinks(items).map((l) => l.id)).toEqual(['about']);
  });
});

describe('LinksPage', () => {
  it('рисует ссылки из массива в том же порядке, без пунктов с пустым адресом', () => {
    render(<LinksPage />);
    const shown = anchors().map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('target')]);
    expect(shown).toEqual(readyLinks().map((l) => [expect.stringContaining(l.title), l.href, null]));
    for (const hidden of LINKS.filter((l) => l.href === null)) {
      expect(screen.queryByText(hidden.title)).toBeNull();
    }
  });

  it('главная кнопка одна — запись на консультацию', () => {
    render(<LinksPage />);
    const primary = anchors().filter((a) => a.classList.contains('lk-primary'));
    expect(primary.map((a) => a.getAttribute('href'))).toEqual(['/#booking']);
  });

  it('клик шлёт событие с кнопкой и источником из utm_source', () => {
    window.history.replaceState({}, '', '/links?utm_source=instagram');
    render(<LinksPage />);
    fireEvent.click(screen.getByText('Статьи'));
    expect(api.trackPublicEvent).toHaveBeenCalledWith('links_page_click', { target: 'articles', from: 'instagram' });
  });

  it('без метки в адресе источник — direct', () => {
    render(<LinksPage />);
    fireEvent.click(screen.getByText('Записаться на консультацию'));
    expect(api.trackPublicEvent).toHaveBeenCalledWith('links_page_click', { target: 'booking', from: 'direct' });
  });
});

function anchors(): HTMLAnchorElement[] {
  return screen.getAllByRole('link') as HTMLAnchorElement[];
}
