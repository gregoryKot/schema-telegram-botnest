// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PeopleTab } from './PeopleTab';

vi.mock('./analyticsApi', () => ({ analyticsApi: { people: vi.fn() } }));
import { analyticsApi } from './analyticsApi';
const people = analyticsApi.people as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => people.mockReset());
afterEach(cleanup);

describe('PeopleTab', () => {
  it('скелетон, затем строки: без имени, роль, любимые функции, «—» без захода', async () => {
    people.mockResolvedValue([
      { id: '1', name: '', role: 'CLIENT', activeDays: 4, events: 20, lastActive: null, top: [{ title: 'Дневник', count: 7 }, { title: 'Справочник', count: 2 }] },
      { id: '2', name: 'Анна', role: 'THERAPIST', activeDays: 1, events: 3, lastActive: new Date().toISOString(), top: [] },
    ]);
    const { container } = render(<PeopleTab adminKey="k" days={7} />);
    expect(container.querySelector('.skel')).toBeTruthy();
    expect(await screen.findByText('Без имени')).toBeTruthy();
    expect(screen.getByText('· клиент')).toBeTruthy();
    expect(screen.getByText('Дневник (7 раз) · Справочник (2 раза)')).toBeTruthy();
    expect(screen.getByText('последний заход: —')).toBeTruthy();
    expect(screen.getByText('последний заход: сегодня')).toBeTruthy();
  });
  it('пустой ответ — «Пока нет данных»', async () => {
    people.mockResolvedValue([]);
    render(<PeopleTab adminKey="k" days={7} />);
    expect(await screen.findByText('Пока нет данных')).toBeTruthy();
  });
  it('ошибка — «Повторить»', async () => {
    people.mockRejectedValueOnce(new Error('Нет доступа: ключ не подошёл'));
    render(<PeopleTab adminKey="k" days={7} />);
    expect(await screen.findByText('Нет доступа: ключ не подошёл')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy();
  });
});
