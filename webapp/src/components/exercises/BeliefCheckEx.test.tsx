// @vitest-environment jsdom
// Кризисная детекция в проверке убеждения (CLAUDE.md, правило №7). Проверяем
// поле "belief" на первом шаге мастера — остальные свободнотекстовые стейты
// (forInput/againstInput/reframe) используют тот же гейт в BeliefCheckEx.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BeliefCheckEx } from './BeliefCheckEx';
import { AddressFormContext } from '../../utils/addressForm';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';

vi.mock('../../api', () => ({
  api: {
    getBeliefChecks: vi.fn(),
    createBeliefCheck: vi.fn(),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSheet() {
  return render(
    <MemoryRouter>
      <BeliefCheckEx onBack={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getBeliefChecks.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('BeliefCheckEx — кризисная детекция (belief)', () => {
  it('кризисная фраза в убеждении показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText(
      'Например: я всегда всё порчу, меня никто не любит…',
    );
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByPlaceholderText(
      'Например: я всегда всё порчу, меня никто не любит…',
    );
    fireEvent.change(textarea, {
      target: { value: 'Я иногда ошибаюсь на работе' },
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// ── Полный проход мастера: 4 шага до сохранения ──────────────────────────────
function walkToLastStep() {
  fireEvent.change(
    screen.getByPlaceholderText(
      'Например: я всегда всё порчу, меня никто не любит…',
    ),
    { target: { value: 'Я всегда всё порчу' } },
  );
  fireEvent.click(screen.getByText(/Дальше · доказательства за/));

  fireEvent.change(screen.getByPlaceholderText('Добавить доказательство…'), {
    target: { value: 'Вчера забыл про встречу' },
  });
  fireEvent.click(screen.getByText('⏎ добавить'));
  fireEvent.click(screen.getByText(/Дальше · доказательства против/));

  fireEvent.change(
    screen.getByPlaceholderText('Добавить контр-доказательство…'),
    {
      target: { value: 'На прошлой неделе всё получилось' },
    },
  );
  fireEvent.click(screen.getByText('⏎ добавить'));
  fireEvent.click(screen.getByText(/Дальше · переформулировка/));

  fireEvent.change(
    screen.getByPlaceholderText(
      'Иногда я действительно ошибаюсь, но это не значит что я всегда всё порчу…',
    ),
    {
      target: {
        value: 'Иногда ошибаюсь, но это не значит что я всегда всё порчу',
      },
    },
  );
}

describe('BeliefCheckEx — ты/вы: вступление и подпись первого шага', () => {
  it('lede и подпись поля звучат в форме «ты»', () => {
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
          <BeliefCheckEx onBack={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/^Поставь одну мысль перед судом фактов/),
    ).toBeTruthy();
    expect(
      screen.getByText('Запиши мысль, которую хочешь проверить'),
    ).toBeTruthy();
  });

  it('lede и подпись поля звучат в форме «вы»', () => {
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
          <BeliefCheckEx onBack={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/^Поставьте одну мысль перед судом фактов/),
    ).toBeTruthy();
    expect(
      screen.getByText('Запишите мысль, которую хотите проверить'),
    ).toBeTruthy();
  });
});

describe('BeliefCheckEx — сохранение: успех', () => {
  it('успешный createBeliefCheck показывает экран «Готово», вызывает onComplete', async () => {
    mockApi.createBeliefCheck.mockResolvedValue(undefined);
    const onComplete = vi.fn();
    render(
      <MemoryRouter>
        <BeliefCheckEx onBack={vi.fn()} onComplete={onComplete} />
      </MemoryRouter>,
    );
    walkToLastStep();
    fireEvent.click(screen.getByText(/Сохранить и закрыть/));

    await screen.findByText('Готово.');
    expect(mockApi.createBeliefCheck).toHaveBeenCalledWith({
      belief: 'Я всегда всё порчу',
      evidenceFor: ['Вчера забыл про встречу'],
      evidenceAgainst: ['На прошлой неделе всё получилось'],
      reframe: 'Иногда ошибаюсь, но это не значит что я всегда всё порчу',
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

// Регрессия: createBeliefCheck().catch(()=>{}) молча глотал отказ, а экран
// всё равно показывал «Готово. Сохранено в дневнике» — прямая ложь при
// отказе сети, работа пользователя терялась незаметно для него.
describe('BeliefCheckEx — сохранение: отказ сети виден пользователю', () => {
  it('ошибка createBeliefCheck НЕ показывает «Готово», показывает сообщение об ошибке', async () => {
    mockApi.createBeliefCheck.mockRejectedValue(new Error('network down'));
    const onComplete = vi.fn();
    render(
      <MemoryRouter>
        <BeliefCheckEx onBack={vi.fn()} onComplete={onComplete} />
      </MemoryRouter>,
    );
    walkToLastStep();
    fireEvent.click(screen.getByText(/Сохранить и закрыть/));

    await screen.findByText(/Не удалось сохранить/i);
    expect(screen.queryByText('Готово.')).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('после ошибки шаг не сброшен — можно нажать «Сохранить» ещё раз без потери ввода', async () => {
    mockApi.createBeliefCheck.mockRejectedValue(new Error('network down'));
    render(
      <MemoryRouter>
        <BeliefCheckEx onBack={vi.fn()} />
      </MemoryRouter>,
    );
    walkToLastStep();
    fireEvent.click(screen.getByText(/Сохранить и закрыть/));
    await screen.findByText(/Не удалось сохранить/i);

    // Ввод переформулировки остался — не очищен отказом.
    expect(
      screen.getByDisplayValue(
        'Иногда ошибаюсь, но это не значит что я всегда всё порчу',
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Сохранить и закрыть/)).not.toHaveProperty(
      'disabled',
      true,
    );
  });

  it('ты/вы: сообщение об отказе звучит в обеих формах', async () => {
    mockApi.createBeliefCheck.mockRejectedValue(new Error('network down'));
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
          <BeliefCheckEx onBack={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    walkToLastStep();
    fireEvent.click(screen.getByText(/Сохранить и закрыть/));
    await screen.findByText(
      'Не удалось сохранить. Проверь связь и попробуй ещё раз',
    );
    cleanup();

    mockApi.createBeliefCheck.mockRejectedValue(new Error('network down'));
    render(
      <MemoryRouter>
        <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
          <BeliefCheckEx onBack={vi.fn()} />
        </AddressFormContext.Provider>
      </MemoryRouter>,
    );
    walkToLastStep();
    fireEvent.click(screen.getByText(/Сохранить и закрыть/));
    await screen.findByText(
      'Не удалось сохранить. Проверьте связь и попробуйте ещё раз',
    );
  });
});
