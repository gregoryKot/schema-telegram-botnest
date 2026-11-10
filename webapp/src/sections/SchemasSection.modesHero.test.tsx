// @vitest-environment jsdom
// Вкладка «Режимы» на телефоне: «Чаще всего включается» над первой группой «Моих режимов» близкой бумаги — белый
// лист с тенью-слоем (ревью g5 r3, patternsTop.modesHeroWhite) — через шов (правило №14): настоящие SchemasSection,
// ModesTopCards и WeekPatternCard, режим недели — из дневника режимов, группы — из профиля.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../utils/addressForm';
import { SchemasSection } from './SchemasSection';

vi.mock('../components/useIsMobile', () => ({ useIsMobile: () => true }));
vi.mock('../api', () => ({
  api: {
    getProfile: vi.fn(), getYsqHistory: vi.fn(), getYsqProgress: vi.fn(), listMyModeMaps: vi.fn(),
    updateSettings: vi.fn(), trackEvent: vi.fn(), getSchemaDiary: vi.fn(), getModeDiary: vi.fn(),
    getSchemaNotes: vi.fn(), getModeNotes: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const modeEntry = (id: number, at: string, modeId: string) => ({ id, createdAt: at, trigger: 'Т', emotions: [], modeId });
const profile = (myModeIds: string[]) => ({
  name: null, role: 'CLIENT' as const, ysq: { completedAt: null, activeSchemaIds: [] },
  notifications: { enabled: false, reminderEnabled: false, timezone: 'UTC', localHour: 9 }, streak: 0,
  lastActivity: { needsTracker: null, schemaDiary: null, modeDiary: null, gratitudeDiary: null },
  mySchemaIds: ['abandonment'], myModeIds,
});

/** Герой вкладки «Режимы» с «Уязвимым Ребёнком» недели; myModeIds задают первую группу «Моих режимов». */
async function modesHero(myModeIds: string[]): Promise<Element> {
  mockApi.getProfile.mockResolvedValue(profile(myModeIds));
  render(
    <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
      <MemoryRouter initialEntries={['/schemas']}><SchemasSection onOpenSchema={vi.fn()} /></MemoryRouter>
    </AddressFormContext.Provider>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Режимы' }));
  return (await screen.findByText('Чаще всего включается')).closest('.pa-sheet')!;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getYsqHistory.mockResolvedValue([]);
  mockApi.getYsqProgress.mockResolvedValue(null);
  mockApi.listMyModeMaps.mockResolvedValue([]);
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([modeEntry(1, daysAgo(0), 'vulnerable_child'), modeEntry(2, daysAgo(1), 'vulnerable_child')]);
  mockApi.getSchemaNotes.mockResolvedValue([]);
  mockApi.getModeNotes.mockResolvedValue([]);
});
afterEach(cleanup);

describe('SchemasSection, вкладка «Режимы»: «Чаще всего включается» над первой группой', () => {
  it('«Уязвимый Ребёнок» над «Детскими режимами» (та же бумага) — белый лист', async () => {
    expect((await modesHero(['vulnerable_child', 'demanding_critic'])).classList.contains('pa-sheet--white')).toBe(true);
  });

  it('над группой Критика (далёкая бумага) — лист своей группы', async () => {
    expect((await modesHero(['demanding_critic'])).classList.contains('pa-sheet--white')).toBe(false);
  });
});
