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
    trackEvent: vi.fn(),
  },
}));
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
});

afterEach(() => {
  cleanup();
});

describe('FlashcardEx (SchemaEx) — кризисная детекция', () => {
  it('кризисная фраза в ответе показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'не хочу жить' } });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Обычно это молчание в переписке' } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

// Аудит 2026-08-22, находка №2: handleSave не показывал состояние отправки,
// не защищал от двойного нажатия и молчал при ошибке. Навигация до
// последнего вопроса (7 вопросов SCHEMA_QUESTIONS) — заполняем первый,
// остальные пропускаем, чтобы дойти до кнопки «Сохранить карточку».
function goToLastStep() {
  const textarea = screen.getByRole('textbox');
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
    goToLastStep();

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
    goToLastStep();

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
    goToLastStep();

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

  it('«Заполнить карточку» открывает форму; «Про режим» возвращает к портрету и обратно', () => {
    renderModeEx();
    fireEvent.click(screen.getByText('Заполнить свою карточку →'));
    expect(screen.getByRole('textbox')).toBeTruthy();

    fireEvent.click(screen.getByText('ⓘ Про режим'));
    expect(screen.getByText('Назад к вопросам →')).toBeTruthy();

    fireEvent.click(screen.getByText('Назад к вопросам →'));
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});
