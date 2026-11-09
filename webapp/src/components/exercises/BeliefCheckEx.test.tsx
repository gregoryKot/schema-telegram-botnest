// @vitest-environment jsdom
// Кризисная детекция в проверке убеждения (CLAUDE.md, правило №7). Проверяем
// поле "belief" на первом шаге мастера — остальные свободнотекстовые стейты
// (forInput/againstInput/reframe) используют тот же гейт в BeliefCheckEx.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BeliefCheckEx } from './BeliefCheckEx';
import { EXERCISE_TEXT_MAX } from '../../../../shared/src/limits/textLimits';
import { AddressFormContext } from '../../utils/addressForm';
import { describeCrisisField } from '../../test-support/crisisCardHarness';

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
  localStorage.clear(); // черновик упражнения не должен переезжать в следующий тест
  mockApi.getBeliefChecks.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

const BELIEF_PLACEHOLDER = 'Например: я всегда всё порчу, меня никто не любит…';
const enterBelief = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText(BELIEF_PLACEHOLDER), { target: { value: text } });

describeCrisisField('webapp/src/components/exercises/BeliefCheckEx.tsx', {
  label: 'убеждение',
  open: renderSheet,
  enter: enterBelief,
});
// Поле доводов — дочерний контрол EviList, детекция у родителя по вводу и списку.
describeCrisisField('webapp/src/components/exercises/beliefCheck/EviList.tsx', {
  label: 'доказательство «за»',
  open: () => {
    renderSheet();
    enterBelief('Я всегда всё порчу');
    fireEvent.click(screen.getByText(/Дальше · доказательства за/));
  },
  enter: (text) =>
    fireEvent.change(screen.getByPlaceholderText('Добавить доказательство…'), { target: { value: text } }),
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
    // QA клиента 2026-11, З14: «Сохранено в дневнике», а в «Записях» проверки
    // нет — она в «Моём пути». Экран называет место, где её найти.
    expect(screen.getByText(/Проверка сохранена в разделе «Мой путь»/)).toBeTruthy();
    expect(screen.queryByText(/в дневнике/)).toBeNull();
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
    localStorage.clear(); // отказ оставил черновик — второй заход с чистого листа

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

// docs/open/frontend-ux.md: текст, набранный в поле доказательства, но не
// добавленный «⏎ добавить», молча терялся при «Дальше» — onAdd() перед
// переходом не вызывался. Теперь переход шага дописывает его в список.
const BELIEF_PH = 'Например: я всегда всё порчу, меня никто не любит…';
function toForStep() {
  renderSheet();
  fireEvent.change(screen.getByPlaceholderText(BELIEF_PH), { target: { value: 'Я всегда всё порчу' } });
  fireEvent.click(screen.getByText(/Дальше · доказательства за/));
}

describe('BeliefCheckEx — недобавленный текст не теряется при переходе', () => {
  it('«Дальше» доступна с одним текстом в поле и дописывает его как доказательство', async () => {
    mockApi.createBeliefCheck.mockResolvedValue(undefined);
    toForStep();
    fireEvent.change(screen.getByPlaceholderText('Добавить доказательство…'), { target: { value: '  Забыт отчёт  ' } });
    const nextFor = screen.getByText(/Дальше · доказательства против/).closest('button')!;
    expect(nextFor.disabled).toBe(false);
    fireEvent.click(nextFor);

    fireEvent.change(screen.getByPlaceholderText('Добавить контр-доказательство…'), { target: { value: 'Проект сдан' } });
    fireEvent.click(screen.getByText(/Дальше · переформулировка/));
    fireEvent.change(
      screen.getByPlaceholderText('Иногда я действительно ошибаюсь, но это не значит что я всегда всё порчу…'),
      { target: { value: 'Иногда ошибаюсь' } },
    );
    fireEvent.click(screen.getByText(/Сохранить и закрыть/));

    await screen.findByText('Готово.');
    expect(mockApi.createBeliefCheck).toHaveBeenCalledWith(expect.objectContaining({
      evidenceFor: ['Забыт отчёт'],
      evidenceAgainst: ['Проект сдан'],
    }));
  });

  it('контроль: одни пробелы в поле и пустой список — «Дальше» недоступна', () => {
    toForStep();
    fireEvent.change(screen.getByPlaceholderText('Добавить доказательство…'), { target: { value: '   ' } });
    expect(screen.getByText(/Дальше · доказательства против/).closest('button')!.disabled).toBe(true);
  });

  it('«Назад» тоже дописывает текст: вернувшись, он виден в списке, поле пустое', () => {
    toForStep();
    fireEvent.change(screen.getByPlaceholderText('Добавить доказательство…'), { target: { value: 'Опоздание' } });
    fireEvent.click(screen.getByRole('button', { name: /^Назад$/ }));
    fireEvent.click(screen.getByText(/Дальше · доказательства за/));
    expect(screen.getByText('Опоздание')).toBeTruthy();
    expect((screen.getByPlaceholderText('Добавить доказательство…') as HTMLInputElement).value).toBe('');
  });
});

// Предел поля = `@MaxLength` DTO (docs/open, «Поля упражнений без лимита»):
// без него длинный текст уходил на сервер, получал 400, а экран писал
// «проверь соединение» — повтор не помогал.
describe('BeliefCheckEx — пределы полей', () => {
  it('мысль и доказательство несут предел DTO проверки убеждения', () => {
    toForStep();
    fireEvent.click(screen.getByRole('button', { name: /^Назад$/ }));
    const belief = screen.getByPlaceholderText(BELIEF_PH) as HTMLTextAreaElement;
    expect(belief.maxLength).toBe(EXERCISE_TEXT_MAX);
    fireEvent.click(screen.getByText(/Дальше · доказательства за/));
    const evidence = screen.getByPlaceholderText(
      'Добавить доказательство…',
    ) as HTMLInputElement;
    expect(evidence.maxLength).toBe(EXERCISE_TEXT_MAX);
  });
});
