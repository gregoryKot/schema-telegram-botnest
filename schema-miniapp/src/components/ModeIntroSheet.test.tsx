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

async function openFirstQuestion(onClose: () => void = () => {}) {
  render(<ModeIntroSheet modeId="vulnerable_child" onClose={onClose} />);
  await act(async () => {}); // flush getModeNotes()
  // Поле ответа видно сразу — без тапа по карточке (переворота больше нет).
  return screen.getByPlaceholderText(/Когда меня критикуют/);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Черновик карточки живёт в localStorage — без очистки предыдущий тест
  // подсовывает следующему свои ответы (карточка приезжает уже заполненной).
  localStorage.clear();
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

// Инцидент 2026-08: «Сохранить карточку» на вид не делала ничего — подпись
// кнопки менялась на 1.8 секунды, шит оставался открытым. Тест держит связку
// «нажал сохранить → запрос ушёл → виден итог → «Готово» закрывает».
describe('ModeIntroSheet — сохранение карточки видно пользователю', () => {
  async function fillAndSave(onClose: () => void = () => {}) {
    const textarea = await openFirstQuestion(onClose);
    fireEvent.change(textarea, { target: { value: 'Когда меня оставляют' } });
    for (let i = 0; i < 6; i++)
      fireEvent.click(screen.getByText('Следующий →'));
    fireEvent.click(screen.getByText('Сохранить карточку'));
    await act(async () => {});
  }

  it('после сохранения показывает итог с ответом, а не молча остаётся на вопросе', async () => {
    await fillAndSave();
    expect(mockApi.saveModeNote).toHaveBeenCalled();
    expect(mockApi.saveModeNote.mock.calls[0][0]).toMatchObject({
      modeId: 'vulnerable_child',
      triggers: 'Когда меня оставляют',
    });
    expect(screen.getByText('Карточка сохранена')).toBeTruthy();
    expect(screen.getByText('Когда меня оставляют')).toBeTruthy();
  });

  it('«Готово» на экране итога закрывает карточку', async () => {
    const onClose = vi.fn();
    await fillAndSave(onClose);
    fireEvent.click(screen.getByText('Готово'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('провал saveModeNote: остаётся на форме, а не показывает «Готово» (regression: check-silent-catch)', async () => {
    // Раньше handleSave шёл на экран «Готово» при любом исходе — провал
    // сохранения на сервере выглядел как успех, хотя карточка осталась
    // только локально.
    mockApi.saveModeNote.mockRejectedValue(new Error('network'));
    await fillAndSave();
    expect(screen.queryByText('Карточка сохранена')).toBeNull();
    expect(
      screen.getByText('Не сохранилось — попробовать ещё раз'),
    ).toBeTruthy();
  });

  it('пустая карточка: кнопка выключена и сказано, чего не хватает', async () => {
    await openFirstQuestion();
    for (let i = 0; i < 6; i++)
      fireEvent.click(screen.getByText('Следующий →'));
    const save = screen.getByText('Сохранить карточку');
    expect(save.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/нужен хотя бы один ответ/i)).toBeTruthy();
    fireEvent.click(save);
    expect(mockApi.saveModeNote).not.toHaveBeenCalled();
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
