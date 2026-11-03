// @vitest-environment jsdom
// Кризисная детекция в FlashcardEx (CLAUDE.md, правило №7). FlashcardFlow —
// общий внутренний компонент SchemaEx/ModeEx (FlashcardEx.tsx), проверяем
// через SchemaEx с initialSchemaId — сразу попадаем на первый вопрос.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaEx, ModeEx } from './FlashcardEx';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';

vi.mock('../../api', () => ({
  api: {
    saveSchemaNote: vi.fn().mockResolvedValue(undefined),
    saveModeNote: vi.fn().mockResolvedValue(undefined),
    getSchemaNotes: vi.fn().mockResolvedValue([]),
    getModeNotes: vi.fn().mockResolvedValue([]),
    trackEvent: vi.fn(),
  },
}));
import { api } from '../../api';
const mockedApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
// modeCards (портреты режимов) — контракт параллельной задачи, ещё не
// подключён на момент написания теста. По умолчанию «нет карточки» →
// ModeEx сразу открывает вопросы (как раньше); портрет — отдельный блок
// ниже, подставляет карточку через mockReturnValue.
vi.mock('../../../../shared/src/mode/modeCards', () => ({
  getModeCard: vi.fn(),
  MODE_CARDS: {},
}));
import { getModeCard } from '../../../../shared/src/mode/modeCards';
const mockGetModeCard = getModeCard as unknown as ReturnType<typeof vi.fn>;

function renderSheet() {
  return render(
    <MemoryRouter>
      <SchemaEx onBack={vi.fn()} initialSchemaId="emotional_deprivation" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetModeCard.mockReturnValue(undefined);
  mockedApi.getSchemaNotes.mockResolvedValue([]);
  mockedApi.getModeNotes.mockResolvedValue([]);
  mockedApi.saveSchemaNote.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('FlashcardEx (SchemaEx) — кризисная детекция', () => {
  it('кризисная фраза в ответе показывает CrisisCard', async () => {
    renderSheet();
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  // Аудит 2026-10, «Доступность»: тики вопросов были pressable()-div без имени.
  it('тик назван номером вопроса, ведёт к нему и помечает текущий', async () => {
    renderSheet();
    expect((await screen.findByRole('button', { name: 'Вопрос 1' })).getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('button', { name: 'Вопрос 1' }).getAttribute('aria-current')).toBe('step');
    fireEvent.click(screen.getByRole('button', { name: 'Вопрос 2' }));
    expect(screen.getByText(/^Вопрос 2 из/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Вопрос 2' }).getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('button', { name: 'Вопрос 1' }).getAttribute('aria-current')).toBeNull();
  });

  it('нейтральный текст не показывает CrisisCard', async () => {
    renderSheet();
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Обычно это молчание в переписке' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// Аудит 2026-08-22, находка №2: handleSave не показывал состояние отправки,
// не защищал от двойного нажатия и молчал при ошибке. Навигация до
// последнего вопроса (7 вопросов SCHEMA_QUESTIONS) — заполняем первый,
// остальные пропускаем, чтобы дойти до кнопки «Сохранить карточку».
async function goToLastStep() {
  const textarea = await screen.findByRole('textbox');
  fireEvent.change(textarea, { target: { value: 'Пример ответа' } });
  for (let i = 0; i < 6; i++) {
    fireEvent.click(screen.getByRole('button', { name: /Дальше|Пропустить/ }));
  }
}

describe('FlashcardEx (SchemaEx) — сохранение: состояние отправки, ошибка, двойное нажатие', () => {
  it('во время сохранения кнопка заблокирована и подписана «Сохраняю…», после успеха — «готово»', async () => {
    const mockApi = (await import('../../api')).api as unknown as Record<string, ReturnType<typeof vi.fn>>;
    let resolveSave: () => void = () => {};
    mockApi.saveSchemaNote.mockImplementation(() => new Promise<void>((res) => { resolveSave = res; }));
    renderSheet();
    await goToLastStep();

    const saveBtn = screen.getByRole('button', { name: /Сохранить карточку/ }) as HTMLButtonElement;
    fireEvent.click(saveBtn);
    expect(screen.getByRole('button', { name: /Сохраняю/ })).toBeTruthy();
    expect((screen.getByRole('button', { name: /Сохраняю/ }) as HTMLButtonElement).disabled).toBe(true);

    resolveSave();
    await screen.findByText('Карточка сохранена · ' + new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }));
  });

  it('повторное нажатие во время отправки не шлёт запрос дважды (защита от двойного клика)', async () => {
    const mockApi = (await import('../../api')).api as unknown as Record<string, ReturnType<typeof vi.fn>>;
    mockApi.saveSchemaNote.mockImplementation(() => new Promise<void>(() => {})); // никогда не резолвится
    renderSheet();
    await goToLastStep();

    const saveBtn = screen.getByRole('button', { name: /Сохранить карточку/ });
    fireEvent.click(saveBtn);
    fireEvent.click(screen.getByRole('button', { name: /Сохраняю/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сохраняю/ }));
    expect(mockApi.saveSchemaNote).toHaveBeenCalledTimes(1);
  });

  it('ошибка сохранения показывает сообщение, а не тишину — карточка не помечается сохранённой', async () => {
    const mockApi = (await import('../../api')).api as unknown as Record<string, ReturnType<typeof vi.fn>>;
    mockApi.saveSchemaNote.mockRejectedValue(new Error('offline'));
    renderSheet();
    await goToLastStep();

    fireEvent.click(screen.getByRole('button', { name: /Сохранить карточку/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/Карточка сохранена/)).toBeNull();
    // Кнопка снова доступна — можно повторить попытку.
    expect((screen.getByRole('button', { name: /Сохранить карточку/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});

// Правило онбординга CLAUDE.md: портрет режима не должен становиться
// недостижимым после первого показа — паритет с миниаппом (кнопка «Про
// режим» в форме возвращает к портрету).
describe('FlashcardEx (ModeEx) — портрет режима: первый показ и ручной возврат', () => {
  const CARD = {
    about: 'Крохотный и настоящий: пугается, что его снова оставят одного.',
    triggers: 'Когда никто не отвечает весь день',
    body: 'Ком в горле',
    voice: '«Меня опять бросят»',
    behavior: 'Замирает и проверяет',
    origin: 'Когда-то рядом правда никого не было',
    cost: 'Пугает партнёра проверками',
    need: 'Надёжного присутствия рядом',
    healthyAdult: 'Я здесь и никуда не денусь',
  };

  function renderModeEx() {
    return render(
      <MemoryRouter>
        <ModeEx onBack={vi.fn()} initialModeId="vulnerable_child" />
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    localStorage.clear();
    mockGetModeCard.mockReturnValue(CARD);
  });

  it('первый раз показывает портрет, а не форму вопросов', () => {
    renderModeEx();
    expect(screen.getByText('Заполнить свою карточку →')).toBeTruthy();
    expect(screen.getByText(CARD.about)).toBeTruthy();
  });

  it('«Заполнить карточку» открывает форму; «Про режим» возвращает к портрету и обратно', async () => {
    renderModeEx();
    fireEvent.click(screen.getByText('Заполнить свою карточку →'));
    expect(await screen.findByRole('textbox')).toBeTruthy();

    fireEvent.click(screen.getByText('ⓘ Про режим'));
    expect(screen.getByText('Назад к вопросам →')).toBeTruthy();

    fireEvent.click(screen.getByText('Назад к вопросам →'));
    expect(await screen.findByRole('textbox')).toBeTruthy();
  });
});

// «Дополнить» из экрана паттерна: сохранение шлёт ВСЕ поля, поэтому форма
// обязана стартовать с уже написанного — иначе карточка затирается пустыми.
describe('FlashcardEx (SchemaEx) — initialData', () => {
  it('поля стартуют с переданных значений, а не с пустых строк', async () => {
    render(
      <MemoryRouter>
        <SchemaEx onBack={vi.fn()} initialSchemaId="emotional_deprivation" initialData={{ triggers: 'Когда молчат', feelings: 'Пусто' }} />
      </MemoryRouter>,
    );
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Когда молчат');
    // Значения пришли готовыми — второй запрос за той же заметкой не нужен.
    expect(mockedApi.getSchemaNotes).not.toHaveBeenCalled();
  });
});

// «Познакомиться →» (SchemaDetailSheet), «Практика», задачи терапевта, плитки
// «Карта режимов» открывают опросник без initialData. Раньше форма стартовала
// пустой и сохранение затирало карточку (docs/INCIDENTS.md, 2026-10-31) —
// теперь написанное грузится внутри упражнения, а до ответа стоит скелетон.
describe('FlashcardEx — вход без initialData грузит сохранённую заметку', () => {
  it('SchemaEx: пока заметка грузится — скелетон, потом поля с написанным', async () => {
    let resolveNotes: (v: unknown) => void = () => {};
    mockedApi.getSchemaNotes.mockImplementation(() => new Promise((res) => { resolveNotes = res; }));
    const { container } = renderSheet();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();

    resolveNotes([
      { schemaId: 'abandonment', triggers: 'чужая' },
      { schemaId: 'emotional_deprivation', triggers: 'Когда молчат', feelings: 'Пусто', reality: null },
    ]);
    const textarea = (await screen.findByRole('textbox')) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Когда молчат');
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Вопрос 2' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Пусто');
  });

  it('SchemaEx: сохранение после загрузки шлёт написанное, а не пустые строки', async () => {
    mockedApi.getSchemaNotes.mockResolvedValue([
      { schemaId: 'emotional_deprivation', triggers: 'Когда молчат', healthyView: 'Я справляюсь' },
    ]);
    renderSheet();
    await screen.findByDisplayValue('Когда молчат');
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: /Дальше|Пропустить/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить карточку/ }));
    await screen.findByText(/Карточка сохранена/);
    expect(mockedApi.saveSchemaNote).toHaveBeenCalledWith(expect.objectContaining({
      schemaId: 'emotional_deprivation', triggers: 'Когда молчат', healthyView: 'Я справляюсь',
    }));
  });

  it('SchemaEx: заметки нет — пустая форма', async () => {
    renderSheet();
    expect(((await screen.findByRole('textbox')) as HTMLTextAreaElement).value).toBe('');
  });

  it('SchemaEx: ошибка загрузки — форма всё равно открывается', async () => {
    mockedApi.getSchemaNotes.mockRejectedValue(new Error('offline'));
    renderSheet();
    expect(((await screen.findByRole('textbox')) as HTMLTextAreaElement).value).toBe('');
    // Пустая форма без объяснения читалась бы как «написанное пропало».
    expect(screen.getByRole('alert').textContent).toMatch(/Не получилось загрузить/);
  });

  it('ModeEx: поля стартуют с сохранённой карточки режима', async () => {
    mockedApi.getModeNotes.mockResolvedValue([{ modeId: 'vulnerable_child', triggers: 'Когда не отвечают' }]);
    render(
      <MemoryRouter>
        <ModeEx onBack={vi.fn()} initialModeId="vulnerable_child" />
      </MemoryRouter>,
    );
    expect(((await screen.findByRole('textbox')) as HTMLTextAreaElement).value).toBe('Когда не отвечают');
    expect(mockedApi.getModeNotes).toHaveBeenCalledTimes(1);
  });
});
