// @vitest-environment jsdom
// «Профиль» на сайте × «Настроить экран»: настройка (те же ключи localStorage
// и события, что у мини-аппа) реально меняет экран — скрывает блоки и задаёт им
// порядок. Связка «переключил в листе → блок исчез / поменялся порядок» — через
// живой лист, а не только через запись в хранилище.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { ProfileSection } from './ProfileSection';

vi.mock('../components/useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('../utils/uiPrefsSync', () => ({ notifyPrefsChanged: vi.fn() }));
vi.mock('../api', () => ({
  api: {
    getStreak: vi.fn(), getAchievements: vi.fn(), getInsights: vi.fn(), history: vi.fn(), getTherapyRelation: vi.fn(),
    getFormerTherapist: vi.fn(() => Promise.resolve(null)),
    getSchemaDiary: vi.fn(), getModeDiary: vi.fn(), getGratitudeDiary: vi.fn(), getYsqHistory: vi.fn(),
    getProfile: vi.fn(), getModeNotes: vi.fn(), getSchemaNotes: vi.fn(), getPhraseChecks: vi.fn(), trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
vi.mock('../auth/authContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
import { api } from '../api';
import { notifyPrefsChanged } from '../utils/uiPrefsSync';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function fill() {
  mockApi.getStreak.mockResolvedValue({ currentStreak: 5, longestStreak: 12, totalDays: 20, todayDone: true, weekDots: [true] });
  mockApi.getAchievements.mockResolvedValue([{ id: 'first_day', earned: true }]);
  mockApi.getInsights.mockResolvedValue({ weeklyStats: [{ needId: 'attachment', avg: 7.2, trend: '↑' }], bestDayOfWeek: 'Пн', worstDayOfWeek: 'Пт', totalDays: 10 });
  mockApi.history.mockResolvedValue([{ date: '2026-08-01', ratings: {} }]);
  for (const k of ['getTherapyRelation']) mockApi[k].mockResolvedValue(null);
  for (const k of ['getSchemaDiary', 'getModeDiary', 'getGratitudeDiary', 'getYsqHistory', 'getModeNotes', 'getSchemaNotes', 'getPhraseChecks']) mockApi[k].mockResolvedValue([]);
  mockApi.getProfile.mockResolvedValue({ ysq: { completedAt: null, activeSchemaIds: [] }, mySchemaIds: [], myModeIds: [] });
}

async function renderProfile() {
  await act(async () => {
    render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <MemoryRouter><ProfileSection onOpenSettings={vi.fn()} /></MemoryRouter>
      </AddressFormContext.Provider>,
    );
  });
}

const blockVar = (el: Element | null) => (el?.closest('.cpf-blk') as HTMLElement | null)?.style.getPropertyValue('--blk-o');
const track = () => mockApi.trackEvent as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); fill(); });
afterEach(cleanup);

describe('ProfileSection × «Настроить экран»', () => {
  it('«Настроить» открывает лист с блоками профиля и шлёт screen_customize_open', async () => {
    await renderProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить экран профиля' }));
    expect(await screen.findByRole('dialog', { name: 'Настроить экран' })).toBeTruthy();
    expect(screen.getAllByRole('switch')).toHaveLength(7);
    expect(track()).toHaveBeenCalledWith('screen_customize_open', { screen: 'profile', via: 'gear' });
  });

  it('тумблер в листе прячет блок на экране, запоминает выбор и сообщает синхронизации; повторный — возвращает', async () => {
    await renderProfile();
    expect(screen.getByText('Достижения', { selector: 'h2' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить экран профиля' }));
    const sw = await screen.findByRole('switch', { name: 'Достижения' });
    fireEvent.click(sw);
    expect(screen.queryByText('Достижения', { selector: 'h2' })).toBeNull();
    expect(localStorage.getItem('screen_hidden_profile')).toBe('["achievements"]');
    expect(track()).toHaveBeenCalledWith('screen_block_toggle', { screen: 'profile', block: 'achievements', hidden: true });
    expect(notifyPrefsChanged).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('switch', { name: 'Достижения' }));
    expect(screen.getByText('Достижения', { selector: 'h2' })).toBeTruthy();
    expect(localStorage.getItem('screen_hidden_profile')).toBeNull();
  });

  it('скрытые в настройке блоки не рисуются сразу при открытии экрана; остальные на месте', async () => {
    localStorage.setItem('screen_hidden_profile', '["streak","insights","journey"]');
    await renderProfile();
    expect(document.querySelector('.cpf-streak-card')).toBeNull();
    expect(screen.queryByText('Мой путь', { selector: 'h2' })).toBeNull();
    expect(screen.queryByText('Паттерны', { selector: 'h2' })).toBeNull();
    expect(screen.getByText('Достижения', { selector: 'h2' })).toBeTruthy();
  });

  it('порядок: по умолчанию как в мини-аппе, сохранённый — приезжает в --blk-o каждого блока', async () => {
    await renderProfile();
    const streak = () => document.querySelector('.cpf-streak-card');
    const journey = () => document.querySelector('.cpf-journey');
    expect(blockVar(journey())).toBe('3');
    expect(blockVar(streak())).toBe('4');
    cleanup();
    localStorage.setItem('screen_order_profile', '["streak","journey"]');
    await renderProfile();
    expect(blockVar(streak())).toBe('1');
    expect(blockVar(journey())).toBe('2');
  });

  it('ручка «≡» в листе переставляет блок: порядок сохраняется и сразу виден на экране', async () => {
    await renderProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить экран профиля' }));
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Переставить: Серия дней' }), { key: 'ArrowUp' });
    expect(blockVar(document.querySelector('.cpf-streak-card'))).toBe('3');
    expect(blockVar(document.querySelector('.cpf-journey'))).toBe('4');
    expect(JSON.parse(localStorage.getItem('screen_order_profile') ?? '[]').slice(0, 4)).toEqual(['portrait', 'warm_words', 'streak', 'journey']);
    expect(track()).toHaveBeenCalledWith('screen_block_move', { screen: 'profile', block: 'streak', dir: 'up' });
  });
});
