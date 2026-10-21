// @vitest-environment jsdom
// «Практика» на телефоне (≤767px, мобильный кабинет по образцу «Помощи»
// мини-аппа): заголовок «Здесь и сейчас» вместо большой шапки, дыхание и
// строки помощи первыми, кризисная строка в одно касание, библиотека —
// «Инструменты». Десктопная раскладка проверена в PracticeSection.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { PracticeSection } from './PracticeSection';

vi.mock('../components/useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('../api', () => ({
  api: {
    getTasks: vi.fn(), getTaskHistory: vi.fn(), getTherapyRelation: vi.fn(),
    getBeliefChecks: vi.fn(), getSchemaNotes: vi.fn(), getModeNotes: vi.fn(),
    getLetters: vi.fn(), getSafePlace: vi.fn(), getChildhoodRatings: vi.fn(),
    getPhraseChecks: vi.fn(), listMyModeMaps: vi.fn(), trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
// Блок «Здесь и сейчас» проверяется своими тестами; здесь важно, что телефонная
// раскладка отдаёт ему compact и строки помощи.
vi.mock('./practice/HereAndNowBlock', () => ({
  HereAndNowBlock: (p: { compact?: boolean; extraRows?: React.ReactNode }) => (
    <div data-testid="here" data-compact={String(!!p.compact)}>{p.extraRows}</div>
  ),
}));

import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const noop = {
  onOpenChildhoodWheel: vi.fn(), onOpenPractices: vi.fn(), onOpenPlans: vi.fn(),
  onOpenTracker: vi.fn(), onOpenDiaries: vi.fn(), onOpenSchema: vi.fn(),
};

function renderPhone(form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter><PracticeSection {...noop} /></MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  for (const k of ['getTasks', 'getTaskHistory', 'getBeliefChecks', 'getSchemaNotes', 'getModeNotes',
    'getLetters', 'getPhraseChecks', 'listMyModeMaps']) mockApi[k].mockResolvedValue([]);
  mockApi.getTherapyRelation.mockResolvedValue(null);
  mockApi.getSafePlace.mockResolvedValue(null);
  mockApi.getChildhoodRatings.mockResolvedValue({});
});
afterEach(cleanup);

describe('PracticeSection на телефоне', () => {
  it('компактная шапка: «Здесь и сейчас», без капса и большого заголовка', async () => {
    renderPhone();
    expect(screen.getByRole('heading', { level: 1, name: 'Здесь и сейчас' })).toBeTruthy();
    expect(screen.queryByText('Упражнения')).toBeNull();
    expect(screen.queryByText(/Восемь практик/)).toBeNull();
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
  });

  it('подпись шапки звучит в обеих формах', async () => {
    renderPhone('ty');
    expect(screen.getByText('Тяжёлый момент? Начни с одного вдоха')).toBeTruthy();
    cleanup();
    renderPhone('vy');
    expect(screen.getByText('Тяжёлый момент? Начните с одного вдоха')).toBeTruthy();
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
  });

  it('помощь первой: compact-блок со строками «Мне плохо» и «Мне очень плохо»', async () => {
    renderPhone();
    const here = screen.getByTestId('here');
    expect(here.getAttribute('data-compact')).toBe('true');
    expect(here.textContent).toContain('Мне плохо');
    expect(here.textContent).toContain('Мне очень плохо');
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
  });

  it('десктопных верхних карточек и отдельного блока помощи нет, кризисные контакты — по касанию', async () => {
    renderPhone();
    expect(screen.queryByText(/Пять шагов: разобраться что происходит/)).toBeNull();
    expect(screen.queryByText('Помощь рядом')).toBeNull();
    fireEvent.click(screen.getByText('Мне очень плохо'));
    expect(screen.getByText('Помощь рядом')).toBeTruthy();
    expect(screen.getAllByText(/8-800-100-49-94/).length).toBeGreaterThan(0);
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
  });

  it('библиотека называется «Инструменты» и содержит все восемь упражнений', async () => {
    renderPhone();
    expect(screen.getByRole('heading', { name: 'Инструменты' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Библиотека' })).toBeNull();
    expect(screen.getByText('Критик или забота?')).toBeTruthy();
    await waitFor(() => expect(mockApi.getTasks).toHaveBeenCalled());
  });
});
