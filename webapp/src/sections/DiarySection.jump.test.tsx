// @vitest-environment jsdom
// К8 (#1686): переходы из «Записей» — к карточке режима из раскрытой записи и кнопки пустых «Трекера»
// и «Случаев» — шлют diary_jump и открывают действие (шов раздел → лента → карточка).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiarySection } from './DiarySection';
import { ALL_MODES } from '../../../shared/src/schemaTherapy/schemaTherapyData';

vi.mock('../api', () => ({ api: { getDiaryPage: vi.fn(), getProfile: vi.fn(), history: vi.fn(), trackEvent: vi.fn() } }));
vi.mock('./diary/DiaryPatternJump', () => ({
  DiaryPatternJump: (p: { target: { kind: string; id: string } }) => <div data-testid="jump">{p.target.kind}:{p.target.id}</div>,
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const MODE = ALL_MODES[0];
let modeEntries: unknown[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  modeEntries = [];
  mockApi.getProfile.mockResolvedValue(null);
  mockApi.history.mockResolvedValue([]);
  mockApi.getDiaryPage.mockImplementation(async (kind: string) => ({ items: kind === 'mode' ? modeEntries : [], hasMore: false }));
});
afterEach(() => cleanup());

const renderSection = (onStart?: (w: 'tracker' | 'case') => void) =>
  render(<MemoryRouter><DiarySection onStart={onStart} /></MemoryRouter>);

describe('DiarySection — переходы (К8)', () => {
  it('раскрытая запись режима → карточка режима и событие pattern', async () => {
    modeEntries = [{ id: 1, createdAt: '2026-08-01T10:00:00Z', modeId: MODE.id, situation: 'Позвонил папа' }];
    renderSection();
    fireEvent.click((await screen.findByText('Позвонил папа')).closest('[role="button"]')!);
    fireEvent.click(screen.getByText(/Карточка режима/));
    expect(screen.getByTestId('jump').textContent).toBe(`mode:${MODE.id}`);
    expect(mockApi.trackEvent).toHaveBeenCalledWith('diary_jump', { to: 'pattern' });
  });

  it.each([[/Трекер/, 'Отметить сегодня', 'tracker'], [/Разборы/, 'Разобрать случай', 'case']] as const)(
    'пустой сегмент %s: кнопка открывает действие и шлёт событие', async (tab, label, what) => {
      const onStart = vi.fn();
      renderSection(onStart);
      const tabs = within(await screen.findByRole('tablist', { name: 'Тип записей' }));
      fireEvent.click(tabs.getByRole('tab', { name: tab }));
      fireEvent.click(await screen.findByText(label));
      expect(onStart).toHaveBeenCalledWith(what);
      expect(mockApi.trackEvent).toHaveBeenCalledWith('diary_jump', { to: what });
    });
});
