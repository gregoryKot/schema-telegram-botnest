// @vitest-environment jsdom
// Выбор блоков «Главного» ходит между устройствами (сохранил → нашёл): терапевт отметил блок на одном
// устройстве → пуш uiPrefs → «сервер» с настоящим sanitizeUiPrefs → другое устройство после стартовой
// синхронизации читает тот же выбор. Настоящие шлюз, синхронизатор, localStorage и хук; подменена только сеть.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../../api', () => ({
  api: { getSettings: vi.fn(), updateSettings: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api } from '../../../api';
import { UiPrefsGate } from '../../UiPrefsGate';
import { useBriefBlocks } from './useBriefBlocks';
import { sanitizeUiPrefs } from '../../../../../src/api/ui-prefs.sanitize';

const getSettings = api.getSettings as unknown as ReturnType<typeof vi.fn>;
const updateSettings = api.updateSettings as unknown as ReturnType<typeof vi.fn>;

// «Сервер» как SettingsController: POST чистит uiPrefs и заменяет целиком, GET отдаёт сохранённое.
let server: Record<string, string> = {};

function Probe() {
  const [ids, toggle] = useBriefBlocks();
  return (
    <div>
      <span data-testid="ids">{ids.join(',')}</span>
      <button onClick={() => toggle('early')}>Ранний опыт</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  server = {};
  vi.clearAllMocks();
  getSettings.mockImplementation(async () => ({ uiPrefs: sanitizeUiPrefs(server) ?? {} }));
  updateSettings.mockImplementation(async (body: { uiPrefs: unknown }) => {
    server = sanitizeUiPrefs(body.uiPrefs) ?? server;
  });
});

describe('useBriefBlocks: выбор блоков между устройствами', () => {
  it('отметил блок на одном устройстве — другое после синхронизации показывает тот же набор', async () => {
    const first = render(<UiPrefsGate><Probe /></UiPrefsGate>);
    await screen.findByTestId('ids');
    // Пуш ждёт окно debounce 1.5 с — на фейковых таймерах, как в UiPrefsGate.test.tsx.
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByText('Ранний опыт'));
      await act(() => vi.advanceTimersByTimeAsync(2000));
    } finally {
      vi.useRealTimers();
    }
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(JSON.parse(server.concept_brief_blocks)).toEqual(['schemas', 'modes', 'needs', 'cycle', 'goals', 'problems', 'early']);
    first.unmount();

    localStorage.clear(); // другое устройство: своё хранилище пустое
    render(<UiPrefsGate><Probe /></UiPrefsGate>);
    expect((await screen.findByTestId('ids')).textContent).toBe('schemas,modes,needs,cycle,goals,problems,early');
  });
});
