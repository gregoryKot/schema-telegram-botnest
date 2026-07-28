// @vitest-environment jsdom
// Кризисная детекция в FlashcardEx (CLAUDE.md, правило №7). FlashcardFlow —
// общий внутренний компонент SchemaEx/ModeEx (FlashcardEx.tsx), проверяем
// через SchemaEx с initialSchemaId — сразу попадаем на первый вопрос.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SchemaEx, ModeEx } from './FlashcardEx';

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
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('нейтральный текст не показывает CrisisCard', () => {
    renderSheet();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Обычно это молчание в переписке' } });
    expect(screen.queryByRole('status')).toBeNull();
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
