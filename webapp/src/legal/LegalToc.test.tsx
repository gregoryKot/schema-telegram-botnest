// @vitest-environment jsdom
// Оглавление юридических страниц (b28): пункты — те же заголовки глав по порядку, ссылки — на существующие
// якоря (cookie-баннер ведёт на #cookies — он сохранён); свёрнутое раскрывается кнопкой, не наведением.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { Chapter } from './LegalLayout';
import { LegalToc } from './LegalToc';
import { tocFromChapters } from './LegalTocModel';
import { PrivacyPage } from '../pages/PrivacyPage';
import { OfferPage } from '../pages/OfferPage';

afterEach(cleanup);

describe('tocFromChapters', () => {
  it('берёт только главы, по порядку; якорь — свой id или номер главы', () => {
    const items = tocFromChapters([
      <Chapter key="1" n="1" title="Первая">x</Chapter>,
      <p key="p">не глава</p>,
      'текст',
      <Chapter key="2" n="2" title="Cookie" id="cookies">y</Chapter>,
    ]);
    expect(items).toEqual([{ id: 'ch-1', label: '1. Первая' }, { id: 'cookies', label: '2. Cookie' }]);
  });
  it('без глав — пусто, оглавления нет', () => {
    expect(tocFromChapters(<p>текст</p>)).toEqual([]);
    const { container } = render(<LegalToc items={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('LegalToc', () => {
  it('свёрнуто; кнопка раскрывает и сворачивает (aria-expanded), выбор пункта сворачивает', () => {
    render(<LegalToc items={[{ id: 'ch-1', label: '1. Первая' }]} />);
    const btn = screen.getByRole('button', { name: 'Содержание' });
    const list = document.getElementById(btn.getAttribute('aria-controls')!)!;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(list.className).toBe('lg-toc-list');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(list.className).toBe('lg-toc-list is-open');
    fireEvent.click(screen.getByRole('link', { name: '1. Первая' }));
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it.each([['политика', PrivacyPage, 13], ['оферта', OfferPage, 15]] as const)('%s: пункт на каждую главу, каждая ссылка ведёт на свой заголовок', (_n, Page, count) => {
    const { container } = render(<Page />);
    const nav = screen.getByRole('navigation', { name: 'Содержание' });
    const links = within(nav).getAllByRole('link');
    const heads = [...container.querySelectorAll('section > h2')];
    expect(links).toHaveLength(count);
    expect(heads).toHaveLength(count);
    links.forEach((a, i) => {
      const target = container.querySelector(a.getAttribute('href')!)!;
      expect(target.querySelector('h2')).toBe(heads[i]);
      expect(a.textContent).toBe(heads[i].textContent!.replace(/^(\d+)\./, '$1. '));
    });
  });

  it('политика: якорь #cookies (баннер cookie) на месте', () => {
    const { container } = render(<PrivacyPage />);
    expect(container.querySelector('#cookies h2')?.textContent).toContain('Cookie-файлы');
  });
});
