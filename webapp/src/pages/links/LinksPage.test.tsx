// @vitest-environment jsdom
// Страница ссылок: пункты и значки площадок рисуются по массиву (ссылка без адреса
// скрыта), клик шлёт links_page_click со своей целью и источником из адреса страницы.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LinksPage } from './LinksPage';
import { LINKS } from './linksData';
import { itemLinks, readyLinks, type LinkItem } from './linksModel';
import { botUrl } from '../../utils/botConfig';
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
  it('ссылка без адреса не рисуется; пункт, которому некуда вести, скрыт', () => {
    const items: LinkItem[] = [
      { kind: 'plain', title: 'А', main: { id: 'about', href: '/' }, places: [{ id: 'project_max', title: 'MAX', href: null }] },
      { kind: 'plain', title: 'Б', main: { id: 'write', href: null } },
      { kind: 'plain', title: 'В', places: [{ id: 'channel_ha', title: 'Telegram', href: 'https://t.me/x' }, { id: 'ha_vk', title: 'ВКонтакте', href: null }] },
      { kind: 'plain', title: 'Г', places: [{ id: 'ha_threads', title: 'Threads', href: null }] },
    ];
    expect(readyLinks(items).map((l) => [l.title, itemLinks(l).map((x) => x.id)])).toEqual([
      ['А', ['about']],
      ['В', ['channel_ha']],
    ]);
  });
});

describe('LinksPage', () => {
  it('рисует ссылки из массива в том же порядке, в той же вкладке', () => {
    render(<LinksPage />);
    const shown = anchors().map((a) => [a.getAttribute('href'), a.getAttribute('target')]);
    expect(shown).toEqual(readyLinks(LINKS).flatMap(itemLinks).map((l) => [l.href, null]));
  });

  it('порядок: запись, «Обо мне» сразу под ней, проект, список, «Здоровый Взрослый» последним', () => {
    render(<LinksPage />);
    const heads = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(heads.slice(0, 2)).toEqual(['/#booking', '/']);
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Всё по схеме', 'Канал о схема-терапии', 'Здоровый Взрослый']);
    const items = [...document.querySelectorAll('.links-list > li')];
    expect(items.at(-1)?.textContent).toContain('Здоровый Взрослый');
  });

  it('значки площадок — соседи основной ссылки, ссылок внутри ссылок нет', () => {
    const { container } = render(<LinksPage />);
    expect(container.querySelector('a a')).toBeNull();
  });

  it.each([
    ['Всё по схеме', 'Бот «Всё по схеме» в Telegram', botUrl, 'project_tg'],
    ['Всё по схеме', 'Бот «Всё по схеме» в MAX', 'https://max.ru/se13646337_bot', 'project_max'],
    ['Здоровый Взрослый', 'Здоровый Взрослый в Telegram', 'https://t.me/MyHealthyAdult', 'channel_ha'],
    ['Здоровый Взрослый', 'Здоровый Взрослый в Threads', 'https://www.threads.com/@yourhealthyadult', 'ha_threads'],
    ['Здоровый Взрослый', 'Здоровый Взрослый во ВКонтакте', 'https://vk.ru/healthyadult', 'ha_vk'],
    ['Здоровый Взрослый', 'Здоровый Взрослый в MAX', 'https://max.ru/join/I-uqSia8bTFSfwNswMeNIDTKcbydSmUntfPcVMEz2Ts', 'ha_max'],
    ['Канал о схема-терапии', 'Канал о схема-терапии в Telegram', 'https://t.me/SchemeHappens', 'channel_schema'],
    ['Канал о схема-терапии', 'Канал о схема-терапии в MAX', 'https://max.ru/se13646337_biz', 'schema_max'],
  ])('«%s» → значок «%s»: свой адрес и своя цель клика', (item, name, href, target) => {
    render(<LinksPage />);
    const icon = within(screen.getByText(item).closest('li')!).getByRole('link', { name });
    expect(icon.getAttribute('href')).toBe(href);
    expect(icon.getAttribute('title')).toBe(name);
    fireEvent.click(icon);
    expect(api.trackPublicEvent).toHaveBeenCalledWith('links_page_click', { target, from: 'direct' }, { keepalive: true });
  });

  it('карточка проекта ведёт на сайт кнопкой «Открыть приложение»', () => {
    render(<LinksPage />);
    const main = within(screen.getByText('Всё по схеме').closest('li')!).getByRole('link', { name: 'Открыть приложение' });
    expect(main.getAttribute('href')).toBe('https://schemehappens.ru');
    fireEvent.click(main);
    expect(api.trackPublicEvent).toHaveBeenCalledWith('links_page_click', { target: 'project', from: 'direct' }, { keepalive: true });
  });

  it('кнопка записи ведёт к форме на визитке', () => {
    render(<LinksPage />);
    const booking = screen.getByRole('link', { name: /Записаться на консультацию.*Первая встреча бесплатно/ });
    expect(booking.getAttribute('href')).toBe('/#booking');
  });

  it('клик шлёт событие с кнопкой и источником из utm_source', () => {
    window.history.replaceState({}, '', '/privet?utm_source=instagram');
    render(<LinksPage />);
    fireEvent.click(screen.getByText('Статьи'));
    expect(api.trackPublicEvent).toHaveBeenCalledWith('links_page_click', { target: 'articles', from: 'instagram' }, { keepalive: true });
  });

  it('без метки в адресе источник — direct', () => {
    render(<LinksPage />);
    fireEvent.click(screen.getByText('Записаться на консультацию'));
    expect(api.trackPublicEvent).toHaveBeenCalledWith('links_page_click', { target: 'booking', from: 'direct' }, { keepalive: true });
  });
});

function anchors(): HTMLAnchorElement[] {
  return screen.getAllByRole('link') as HTMLAnchorElement[];
}
