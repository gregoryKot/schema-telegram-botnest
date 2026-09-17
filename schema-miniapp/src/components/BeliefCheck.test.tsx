// @vitest-environment jsdom
// Правило №7 CLAUDE.md: все текстовые поля проверки убеждения (убеждение,
// за/против, переформулировка) обязаны проходить через кризисную детекцию.
// Тест бьёт по первому (belief) и последнему (reframe) шагу — оба используют
// один и тот же CrisisGate, остальные шаги устроены идентично.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { BeliefCheck } from './BeliefCheck';
import { AddressFormContext } from '../utils/addressForm';
import { CRISIS_HOTLINE_DISPLAY } from '../utils/crisisMarkers';

vi.mock('../api', () => ({
  api: {
    getBeliefChecks: vi.fn(),
    createBeliefCheck: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockApi.getBeliefChecks.mockResolvedValue([]);
  mockApi.createBeliefCheck.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

async function renderSheet() {
  render(<BeliefCheck onClose={() => {}} />);
  await act(async () => {}); // flush getBeliefChecks()
  return screen.getByPlaceholderText(
    'Например: я всегда всё порчу, меня никто не любит...',
  );
}

describe('BeliefCheck — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в убеждении', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('не показывает карточку при нейтральном убеждении', async () => {
    const textarea = await renderSheet();
    fireEvent.change(textarea, { target: { value: 'я всегда опаздываю' } });
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });

  it('показывает карточку на шаге переформулировки при кризисной фразе', async () => {
    const belief = await renderSheet();
    fireEvent.change(belief, { target: { value: 'я всегда опаздываю' } });
    fireEvent.click(screen.getByText('Дальше →')); // -> for
    fireEvent.click(screen.getByText('Дальше →')); // -> against
    fireEvent.click(screen.getByText('Дальше →')); // -> reframe
    const reframe = screen.getByPlaceholderText(
      'Например: иногда я ошибаюсь, но это не значит что я всегда всё порчу...',
    );
    fireEvent.change(reframe, { target: { value: 'хочу умереть' } });
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });
});

describe('BeliefCheck — шаг «убеждение»: кнопка «Дальше» доступна только с текстом', () => {
  it('пустое поле — «Дальше →» недоступна', async () => {
    await renderSheet();
    expect(screen.getByText('Дальше →').hasAttribute('disabled')).toBe(true);
  });

  it('после ввода текста — доступна', async () => {
    const belief = await renderSheet();
    fireEvent.change(belief, { target: { value: 'я всегда всё порчу' } });
    expect(screen.getByText('Дальше →').hasAttribute('disabled')).toBe(false);
  });
});

// Проходит все 4 шага мастера и оставляет курсор на шаге «переформулировка»
// с заполненными полями, готовыми к сохранению. Общий шаг для тестов успеха
// и отказа сети — избегаем дублирования одной и той же прогулки по мастеру.
async function walkToReframeStep() {
  const belief = await renderSheet();
  fireEvent.change(belief, { target: { value: 'я всегда всё порчу' } });
  fireEvent.click(screen.getByText('Дальше →')); // -> for

  // Добавляем два доказательства «за», одно удаляем.
  const forInput = screen.getByPlaceholderText('Добавить...');
  fireEvent.change(forInput, { target: { value: 'вчера опоздал' } });
  fireEvent.click(screen.getByText('+'));
  fireEvent.change(forInput, { target: { value: 'забыл про звонок' } });
  fireEvent.keyDown(forInput, { key: 'Enter' });
  expect(screen.getByText('• вчера опоздал')).toBeTruthy();
  expect(screen.getByText('• забыл про звонок')).toBeTruthy();
  fireEvent.click(screen.getAllByText('×')[0]);
  expect(screen.queryByText('• вчера опоздал')).toBeNull();
  expect(screen.getByText('• забыл про звонок')).toBeTruthy();

  fireEvent.click(screen.getByText('Дальше →')); // -> against
  const againstInput = screen.getByPlaceholderText('Добавить...');
  fireEvent.change(againstInput, {
    target: { value: 'на прошлой неделе всё сделал вовремя' },
  });
  fireEvent.click(screen.getByText('+'));

  fireEvent.click(screen.getByText('Дальше →')); // -> reframe
  const reframe = screen.getByPlaceholderText(
    'Например: иногда я ошибаюсь, но это не значит что я всегда всё порчу...',
  );
  fireEvent.change(reframe, {
    target: { value: 'иногда ошибаюсь, но не всегда' },
  });
}

describe('BeliefCheck — полный флоу: убеждение → за → против → переформулировка → сохранение', () => {
  it('сохранение отправляет реальные данные и открывает финальный экран', async () => {
    await walkToReframeStep();

    fireEvent.click(screen.getByText('Сохранить'));

    // Реальные данные, не заглушка — как ввёл пользователь.
    await waitFor(() =>
      expect(mockApi.createBeliefCheck).toHaveBeenCalledWith({
        belief: 'я всегда всё порчу',
        evidenceFor: ['забыл про звонок'],
        evidenceAgainst: ['на прошлой неделе всё сделал вовремя'],
        reframe: 'иногда ошибаюсь, но не всегда',
      }),
    );
    // localStorage тоже обновился (офлайн-первое сохранение).
    const saved = JSON.parse(localStorage.getItem('belief_checks') ?? '[]');
    expect(saved[0].belief).toBe('я всегда всё порчу');

    // Финальный экран — сводка тех же реальных данных, показывается только
    // после подтверждения сервера.
    await screen.findByText('Проверено');
    expect(screen.getByText('«я всегда всё порчу»')).toBeTruthy();
    expect(screen.getByText('• забыл про звонок')).toBeTruthy();
    expect(
      screen.getByText('• на прошлой неделе всё сделал вовремя'),
    ).toBeTruthy();
    expect(screen.getByText('иногда ошибаюсь, но не всегда')).toBeTruthy();

    fireEvent.click(screen.getByText('Готово'));
  });
});

// Регрессия: api.createBeliefCheck().catch(()=>{}) молча глотал отказ, а
// мастер всё равно уходил на финальный экран «Проверено» — прямая ложь при
// отказе сети. localStorage пишется сразу (офлайн-первое сохранение), это
// делает баг менее опасным (работа не теряется физически), но пользователь
// обязан увидеть, что сервер её не принял.
describe('BeliefCheck — сохранение: отказ сети виден, работа не теряется', () => {
  it('ошибка createBeliefCheck НЕ показывает «Проверено», показывает сообщение об ошибке', async () => {
    mockApi.createBeliefCheck.mockRejectedValue(new Error('network down'));
    await walkToReframeStep();

    fireEvent.click(screen.getByText('Сохранить'));

    await screen.findByText(/Не удалось сохранить на сервере/i);
    expect(screen.queryByText('Проверено')).toBeNull();

    // Данные всё равно легли в localStorage — работа не потеряна физически,
    // просто сервер её ещё не подтвердил.
    const saved = JSON.parse(localStorage.getItem('belief_checks') ?? '[]');
    expect(saved[0].belief).toBe('я всегда всё порчу');
  });

  it('после ошибки можно нажать «Сохранить» ещё раз без потери ввода и без дублей в localStorage', async () => {
    mockApi.createBeliefCheck.mockRejectedValueOnce(new Error('down'));
    await walkToReframeStep();

    fireEvent.click(screen.getByText('Сохранить'));
    await screen.findByText(/Не удалось сохранить на сервере/i);

    // Ввод переформулировки остался — не очищен отказом.
    expect(
      screen.getByDisplayValue('иногда ошибаюсь, но не всегда'),
    ).toBeTruthy();

    mockApi.createBeliefCheck.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByText('Сохранить'));
    await screen.findByText('Проверено');

    expect(mockApi.createBeliefCheck).toHaveBeenCalledTimes(2);
    const saved = JSON.parse(localStorage.getItem('belief_checks') ?? '[]');
    expect(saved.length).toBe(1); // не задвоилось повторным сохранением
  });

  it('ты/вы: сообщение об отказе звучит в обеих формах', async () => {
    mockApi.createBeliefCheck.mockRejectedValue(new Error('down'));
    await walkToReframeStep();
    fireEvent.click(screen.getByText('Сохранить'));
    await screen.findByText(
      'Не удалось сохранить на сервере. Работа осталась на этом устройстве — попробуй ещё раз.',
    );
    cleanup();

    localStorage.clear();
    mockApi.createBeliefCheck.mockRejectedValue(new Error('down'));
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
        <BeliefCheck onClose={() => {}} />
      </AddressFormContext.Provider>,
    );
    await act(async () => {});
    fireEvent.change(
      screen.getByPlaceholderText(
        'Например: я всегда всё порчу, меня никто не любит...',
      ),
      { target: { value: 'я всегда всё порчу' } },
    );
    fireEvent.click(screen.getByText('Дальше →')); // -> for
    fireEvent.click(screen.getByText('Дальше →')); // -> against
    fireEvent.click(screen.getByText('Дальше →')); // -> reframe
    fireEvent.change(
      screen.getByPlaceholderText(
        'Например: иногда я ошибаюсь, но это не значит что я всегда всё порчу...',
      ),
      { target: { value: 'иногда ошибаюсь, но не всегда' } },
    );
    fireEvent.click(screen.getByText('Сохранить'));
    await screen.findByText(
      'Не удалось сохранить на сервере. Работа осталась на этом устройстве — попробуйте ещё раз.',
    );
  });
});

describe('BeliefCheck — прошлые проверки: реальные данные с сервера, не заглушка', () => {
  it('пусто на сервере — блок «Прошлые проверки» не рендерится', async () => {
    await renderSheet();
    expect(screen.queryByText('Прошлые проверки')).toBeNull();
  });

  it('есть история — показывает реальное сохранённое убеждение', async () => {
    mockApi.getBeliefChecks.mockResolvedValueOnce([
      {
        id: 1,
        belief: 'меня никто не любит',
        evidenceFor: [],
        evidenceAgainst: [],
        reframe: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await renderSheet();
    expect(screen.getByText('Прошлые проверки')).toBeTruthy();
    expect(screen.getByText('«меня никто не любит»')).toBeTruthy();
  });
});
