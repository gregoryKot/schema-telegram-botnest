// @vitest-environment jsdom
// Тот же аудит автосейва, что и SchemaIntroSheet.test.tsx (см. комментарий
// там) — ModeIntroSheet использует идентичный паттерн `set()`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { ModeIntroSheet } from './ModeIntroSheet';

vi.mock('../api', () => ({
  api: { getModeNotes: vi.fn(), saveModeNote: vi.fn(), trackEvent: vi.fn() },
}));
// modeCards (портреты режимов) — контракт параллельной задачи, ещё не
// подключён на момент написания теста. По умолчанию «нет карточки» →
// компонент сразу открывает фазу вопросов (как раньше); блок про портрет
// ниже подставляет карточку через mockReturnValue.
vi.mock('../../../shared/src/mode/modeCards', () => ({
  getModeCard: vi.fn(),
  MODE_CARDS: {},
}));
import { api } from '../api';
import { getModeCard } from '../../../shared/src/mode/modeCards';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockGetModeCard = getModeCard as unknown as ReturnType<typeof vi.fn>;

async function openFirstQuestion() {
  render(<ModeIntroSheet modeId="vulnerable_child" onClose={() => {}} />);
  await act(async () => {}); // flush getModeNotes()
  fireEvent.click(screen.getByText('Когда этот режим включается?'));
  return screen.getByPlaceholderText(/Когда меня критикуют/);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockApi.getModeNotes.mockResolvedValue([]);
  mockApi.saveModeNote.mockResolvedValue(undefined);
  mockGetModeCard.mockReturnValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ModeIntroSheet — автосейв карточки (setTimeout(1500) в set())', () => {
  it('не отправляет запрос сразу — только после паузы 1500мс', async () => {
    const textarea = await openFirstQuestion();
    fireEvent.change(textarea, { target: { value: 'Триггер' } });
    expect(mockApi.saveModeNote).not.toHaveBeenCalled();
  });

  it('НЕ БАГ: серия быстрых правок в одном окне дебаунса — сохраняется ПОСЛЕДНЕЕ значение, один вызов api', async () => {
    const textarea = await openFirstQuestion();
    fireEvent.change(textarea, { target: { value: 'K' } });
    fireEvent.change(textarea, { target: { value: 'Kр' } });
    fireEvent.change(textarea, { target: { value: 'Крик' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mockApi.saveModeNote).toHaveBeenCalledTimes(1);
    expect(mockApi.saveModeNote.mock.calls[0][0]).toMatchObject({
      modeId: 'vulnerable_child',
      triggers: 'Крик',
    });
  });

  it('НЕ БАГ: вторая волна правок после завершённого автосейва не отстаёт на шаг', async () => {
    const textarea = await openFirstQuestion();
    fireEvent.change(textarea, { target: { value: 'A' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mockApi.saveModeNote.mock.calls[0][0].triggers).toBe('A');

    fireEvent.change(textarea, { target: { value: 'AB' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mockApi.saveModeNote).toHaveBeenCalledTimes(2);
    expect(mockApi.saveModeNote.mock.calls[1][0].triggers).toBe('AB');
  });
});

// Правило онбординга CLAUDE.md: справочный контент не должен становиться
// недостижимым после первого показа — портрет обязан открываться повторно
// с экрана вопросов (кнопка «Про режим» в шапке).
describe('ModeIntroSheet — портрет режима: первый показ и ручной возврат', () => {
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

  beforeEach(() => {
    localStorage.clear();
    mockGetModeCard.mockReturnValue(CARD);
  });

  it('первый раз показывает портрет, а не форму', () => {
    render(<ModeIntroSheet modeId="vulnerable_child" onClose={() => {}} />);
    expect(screen.getByText('Заполнить свою карточку →')).toBeTruthy();
    expect(screen.getByText(CARD.about)).toBeTruthy();
  });

  it('после заполнения кнопка «Про режим» возвращает к портрету, а оттуда — снова к вопросам', async () => {
    render(<ModeIntroSheet modeId="vulnerable_child" onClose={() => {}} />);
    fireEvent.click(screen.getByText('Заполнить свою карточку →'));
    await act(async () => {});

    const infoBtn = screen.getByLabelText('Про режим');
    fireEvent.click(infoBtn);
    expect(screen.getByText('Назад к вопросам →')).toBeTruthy();

    fireEvent.click(screen.getByText('Назад к вопросам →'));
    await act(async () => {});
    expect(screen.getByLabelText('Про режим')).toBeTruthy();
  });
});
