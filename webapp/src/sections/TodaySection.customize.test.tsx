// @vitest-environment jsdom
// «Сегодня» на сайте × «Настроить экран»: настройка (те же ключи localStorage,
// что у мини-аппа) реально меняет экран — порядок блоков, скрытая фраза и
// серия, баннер кабинета, раскрывашка «Что ещё можно сегодня».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { TodaySection } from './TodaySection';

vi.mock('../components/useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('../components/exercises/FlashcardEx', () => ({ SchemaEx: () => null, ModeEx: () => null }));
vi.mock('../api', () => ({
  api: {
    getProfile: vi.fn(), getSchemaDiary: vi.fn(), getModeDiary: vi.fn(), getGratitudeDiary: vi.fn(),
    getTherapyRelation: vi.fn(), history: vi.fn(), getTasks: vi.fn(), getTaskHistory: vi.fn(),
    trackEvent: vi.fn(), getHealthyPhrase: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const NEEDS = [{ id: 'attachment', emoji: '🤝', title: 'Привязанность', chartLabel: 'Привяз.' }];
const onOpenAdvanced = vi.fn();

function renderToday(userRole: 'CLIENT' | 'THERAPIST' = 'CLIENT') {
  return render(
    <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
      <MemoryRouter>
        <TodaySection
          needs={NEEDS} ratings={{}} onNavigate={vi.fn()} onOpenSchema={vi.fn()} onOpenAdvanced={onOpenAdvanced}
          onOpenTracker={vi.fn()} onOpenDiaries={vi.fn()} onOpenChildhoodWheel={vi.fn()}
          userRole={userRole} onOpenTherapistCabinet={vi.fn()}
        />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getProfile.mockResolvedValue({
    name: 'Аня', role: 'CLIENT', ysq: { completedAt: null, activeSchemaIds: [] }, streak: 4, mySchemaIds: [], myModeIds: [],
  });
  for (const k of ['getSchemaDiary', 'getModeDiary', 'getGratitudeDiary', 'history', 'getTasks', 'getTaskHistory']) mockApi[k].mockResolvedValue([]);
  mockApi.getTherapyRelation.mockResolvedValue(null);
  mockApi.getHealthyPhrase.mockResolvedValue({ text: 'Я справлюсь шаг за шагом' });
});
afterEach(cleanup);

describe('TodaySection × «Настроить экран»', () => {
  it('шестерёнка на телефоне открывает лист настройки, а не общие настройки; строка внутри ведёт в общие', async () => {
    renderToday();
    fireEvent.click(screen.getByRole('button', { name: 'Настроить экран' }));
    expect(onOpenAdvanced).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog', { name: 'Настроить экран' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Общие настройки приложения/ }));
    expect(onOpenAdvanced).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('порядок блоков по умолчанию и сохранённый порядок приезжают в CSS-переменных сетки', () => {
    const { container, unmount } = renderToday();
    const grid = () => container.querySelector('.ct-grid') as HTMLElement;
    expect(grid().style.getPropertyValue('--ct-o-streak')).toBe('20');
    expect(grid().style.getPropertyValue('--ct-o-focus')).toBe('30');
    unmount();
    localStorage.setItem('screen_order_today', '["phrase","focus"]');
    const second = renderToday();
    const g = second.container.querySelector('.ct-grid') as HTMLElement;
    expect(g.style.getPropertyValue('--ct-o-phrase')).toBe('10');
    expect(g.style.getPropertyValue('--ct-o-focus')).toBe('20');
  });

  it('фраза показана, пока её не скрыли в настройке', async () => {
    renderToday();
    expect(await screen.findByText(/Я справлюсь шаг за шагом/)).toBeTruthy();
    cleanup();
    localStorage.setItem('today_phrase_hidden', '1');
    renderToday();
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.queryByText(/Я справлюсь шаг за шагом/)).toBeNull();
    expect(screen.queryByText('Фраза для себя')).toBeNull();
  });

  it('скрытая серия не рисуется на телефоне', async () => {
    renderToday();
    expect(await screen.findByText('4 дня подряд')).toBeTruthy();
    cleanup();
    localStorage.setItem('today_streak_hidden', '1');
    renderToday();
    await waitFor(() => expect(mockApi.getProfile).toHaveBeenCalled());
    expect(screen.queryByText('4 дня подряд')).toBeNull();
  });

  it('«Что ещё можно сегодня»: по умолчанию раскрывашка есть; выключили сворачивание — блок раскрыт, раскрывашки нет', () => {
    renderToday();
    expect(screen.getByRole('button', { name: /Что ещё можно сегодня/ })).toBeTruthy();
    cleanup();
    localStorage.setItem('today_secondary_hidden', '0');
    const { container } = renderToday();
    expect(screen.queryByRole('button', { name: /Что ещё можно сегодня/ })).toBeNull();
    expect(container.querySelector('.ct-grid.is-more-open')).not.toBeNull();
  });

  it('баннер кабинета: у специалиста есть, скрытый в настройке — нет', () => {
    renderToday('THERAPIST');
    expect(screen.getByText('Кабинет терапевта')).toBeTruthy();
    cleanup();
    localStorage.setItem('today_therapist_banner_hidden', '1');
    renderToday('THERAPIST');
    expect(screen.queryByText('Кабинет терапевта')).toBeNull();
  });
});
