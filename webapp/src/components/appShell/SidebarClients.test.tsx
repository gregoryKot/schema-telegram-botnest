// @vitest-environment jsdom
// Сайдбар кабинета (QA 2026-11): порядок как у «Все клиенты» (sortRoster),
// поиск без учёта «ё/е», инициалы из двух слов, а не две буквы имени.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TherapyClientSummary } from '../../api';
import { SidebarClients } from './SidebarClients';
import { sortRoster } from '../therapist/rosterModel';
import { todayStr } from '../../utils/format';
import { localDateStr } from '../../../../shared/src/utils/format';
import { forEachTimeZone } from '../../../../shared/src/utils/timeZone.test-helpers';

afterEach(() => { cleanup(); vi.useRealTimers(); });

let nextId = 1;
function client(o: Partial<TherapyClientSummary>): TherapyClientSummary {
  return {
    telegramId: nextId++, name: 'Иван', clientAlias: null, streak: 0,
    lastActiveDate: null, todayIndex: null, recentIndexHistory: [],
    relationCreatedAt: '2026-01-01T00:00:00Z', therapyStartDate: null,
    nextSession: null, meetingDays: [], schemaIds: [], ...o,
  };
}

const renderSidebar = (clients: TherapyClientSummary[]) =>
  render(<MemoryRouter><SidebarClients clients={clients} /></MemoryRouter>);
const shownNames = () =>
  Array.from(document.querySelectorAll('.sb-client-name')).map((el) => el.textContent);
const search = () => screen.getByPlaceholderText('Поиск клиента…');

describe('SidebarClients', () => {
  it('без клиентов не рисует ничего — ни заголовка, ни поиска', () => {
    const { container } = renderSidebar([]);
    expect(container.innerHTML).toBe('');
  });

  it('порядок — как у списка клиентов: ближайшая встреча первой, остальные по алфавиту', () => {
    const clients = [
      client({ name: 'Яна' }),
      client({ name: 'Борис', nextSession: '2020-01-01T10:00' }), // прошедшая встреча не поднимает
      client({ clientAlias: 'Вера', nextSession: '2099-01-01T10:00' }),
      client({ name: 'Анна' }),
    ];
    renderSidebar(clients);
    expect(shownNames()).toEqual(['Вера', 'Анна', 'Борис', 'Яна']);
    expect(shownNames()).toEqual(sortRoster(clients, todayStr()).map((c) => c.clientAlias ?? c.name));
  });

  // Встреча — настенное время терапевта, «сегодня» — его местный день (№25).
  // 22:30Z: в Иерусалиме и Сиднее уже завтра, в Лос-Анджелесе ещё сегодня.
  it('встреча на местное «сегодня» поднимает клиента в любой зоне, вчерашняя — нет', () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-15T22:30:00Z'), toFake: ['Date'] });
    forEachTimeZone((tz) => {
      const now = new Date();
      const today = localDateStr(now);
      const yesterday = localDateStr(new Date(now.getTime() - 86_400_000));
      renderSidebar([
        client({ name: 'Анна', nextSession: `${yesterday}T10:00` }),
        client({ name: 'Яна', nextSession: `${today}T23:00` }),
      ]);
      expect(shownNames(), tz).toEqual(['Яна', 'Анна']);
      cleanup();
    });
  });

  it('поиск не различает «е» и «ё» в обе стороны и ищет по алиасу', () => {
    renderSidebar([
      client({ name: 'Семён' }),
      client({ name: 'Алена' }),
      client({ name: 'Игорь', clientAlias: 'Пётр' }),
      client({ name: 'Мария' }),
      client({ name: 'Олег' }),
    ]);
    fireEvent.change(search(), { target: { value: 'семен' } });
    expect(shownNames()).toEqual(['Семён']);
    fireEvent.change(search(), { target: { value: 'АЛЁНА' } });
    expect(shownNames()).toEqual(['Алена']);
    fireEvent.change(search(), { target: { value: 'петр' } });
    expect(shownNames()).toEqual(['Пётр']);
    fireEvent.change(search(), { target: { value: '' } });
    expect(shownNames()).toHaveLength(5);
  });

  it('поиск появляется с пятого клиента', () => {
    const four = ['А', 'Б', 'В', 'Г'].map((name) => client({ name }));
    renderSidebar(four);
    expect(screen.queryByPlaceholderText('Поиск клиента…')).toBeNull();
    cleanup();
    renderSidebar([...four, client({ name: 'Д' })]);
    expect(search()).toBeTruthy();
  });

  it('инициалы — первые буквы двух слов; без имени — «#»; ссылка ведёт в карточку', () => {
    const anna = client({ name: 'Анна Крылова' });
    const noName = client({ name: null });
    renderSidebar([anna, noName]);
    const avatars = Array.from(document.querySelectorAll('.sb-client-av')).map((el) => el.textContent);
    expect(avatars).toEqual(['#', 'АК']); // без имени сортируется как пустая строка — первым
    expect(screen.getByText('Анна Крылова').closest('a')?.getAttribute('href')).toBe(`/cabinet/${anna.telegramId}`);
  });

  it('точка «заполнил сегодня» — только у клиента с индексом дня', () => {
    renderSidebar([client({ name: 'Анна', todayIndex: 6.4 }), client({ name: 'Борис' })]);
    const dots = Array.from(document.querySelectorAll('.sb-client-item'))
      .map((el) => el.querySelector('.sb-active-dot') !== null);
    expect(dots).toEqual([true, false]);
  });
});
