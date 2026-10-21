// @vitest-environment jsdom
// Лист «Мой портрет»: списки «Мои схемы»/«Мои режимы» со статусом карточки и
// частотой за неделю (из общего usePatternLayer), строка открывает экран
// паттерна, открытие трекается. Пусто — подсказка вместо тишины.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AddressFormContext } from '../../utils/addressForm';
import { buildPortrait } from '../../../../shared/src/portrait/portraitData';
import type { AboutMeState } from '../../../../shared/src/portrait/useAboutMe';
import { PortraitSheet } from './PortraitSheet';

vi.mock('../../api', () => ({
  api: {
    getSchemaDiary: vi.fn(), getModeDiary: vi.fn(), getSchemaNotes: vi.fn(), getModeNotes: vi.fn(), trackEvent: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
vi.mock('../../components/patternSheet/PatternSheet', () => ({
  PatternSheet: (p: { kind: string; id: string; onClose: () => void }) => (
    <div data-testid="pattern-sheet">{p.kind}:{p.id}<button onClick={p.onClose}>закрыть паттерн</button></div>
  ),
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function aboutMe(schemas: string[], modes: string[]) {
  return { portrait: buildPortrait({ manualSchemaIds: schemas, myModeIds: modes }), mySchemaIds: schemas, myModeIds: modes } as unknown as AboutMeState;
}
function renderSheet(state: AboutMeState, onClose = vi.fn(), form: 'ty' | 'vy' = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <MemoryRouter><PortraitSheet aboutMe={state} onClose={onClose} /></MemoryRouter>
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getSchemaDiary.mockResolvedValue([]);
  mockApi.getModeDiary.mockResolvedValue([]);
  mockApi.getSchemaNotes.mockResolvedValue([]);
  mockApi.getModeNotes.mockResolvedValue([]);
});
afterEach(cleanup);

describe('PortraitSheet', () => {
  it('пусто: подсказка отметить схемы или пройти тест, форма «вы» — без «ты»', async () => {
    renderSheet(aboutMe([], []), vi.fn(), 'vy');
    expect(screen.getByText(/Отметьте схемы и режимы, которые узнаёте/)).toBeTruthy();
    expect(screen.queryByText('Мои схемы')).toBeNull();
    await waitFor(() => expect(mockApi.getSchemaDiary).toHaveBeenCalled());
  });

  it('списки схем и режимов; статус карточки словами и частота — из дневника', async () => {
    mockApi.getSchemaDiary.mockResolvedValue([
      { id: 1, createdAt: daysAgo(0), trigger: 'Т', emotions: [], schemaIds: ['abandonment'] },
      { id: 2, createdAt: daysAgo(1), trigger: 'Т', emotions: [], schemaIds: ['abandonment'] },
    ]);
    renderSheet(aboutMe(['abandonment', 'mistrust'], ['vulnerable_child']));
    expect(screen.getByText('Мои схемы')).toBeTruthy();
    expect(screen.getByText('Мои режимы')).toBeTruthy();
    expect(await screen.findByText('2 дня')).toBeTruthy();
    expect(screen.getAllByText(/карточка пока пустая/).length).toBe(3);
  });

  it('пока дневник не загрузился, статус и частоту не выдумываем', () => {
    mockApi.getSchemaDiary.mockReturnValue(new Promise(() => {}));
    renderSheet(aboutMe(['abandonment'], []));
    expect(screen.queryByText(/карточка пока пустая/)).toBeNull();
  });

  it('строка открывает экран паттерна и трекает открытие; закрытие паттерна оставляет лист', async () => {
    renderSheet(aboutMe(['abandonment'], ['vulnerable_child']));
    await screen.findAllByText(/карточка пока пустая/);
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('cpf-prow'))!);
    expect((await screen.findByTestId('pattern-sheet')).textContent).toContain('schema:abandonment');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('profile_pattern_open', { kind: 'schema' });
    fireEvent.click(screen.getByText('закрыть паттерн'));
    expect(screen.queryByTestId('pattern-sheet')).toBeNull();
    expect(screen.getByText('Мои схемы')).toBeTruthy();
  });

  it('режим открывается как режим', async () => {
    renderSheet(aboutMe([], ['vulnerable_child']));
    await screen.findAllByText(/карточка пока пустая/);
    fireEvent.click(screen.getAllByRole('button').find((b) => b.classList.contains('cpf-prow'))!);
    expect((await screen.findByTestId('pattern-sheet')).textContent).toContain('mode:vulnerable_child');
    expect(mockApi.trackEvent).toHaveBeenCalledWith('profile_pattern_open', { kind: 'mode' });
  });

  it('«Назад» закрывает лист', async () => {
    const onClose = vi.fn();
    renderSheet(aboutMe(['abandonment'], []), onClose);
    fireEvent.click(screen.getByText(/Назад/));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
