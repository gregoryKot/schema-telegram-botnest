// @vitest-environment jsdom
// Правило №7 CLAUDE.md: дневник режимов прогоняет свободный текст через
// кризисную детекцию. Поле «ситуация» живёт на шаге 3 (после выбора
// состояния и режима), поэтому режим преселектим через черновик.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { ModeEntrySheet } from './ModeEntrySheet';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

// Преселект режима через черновик → поток открывается сразу на шаге записи.
function seedMode() {
  localStorage.setItem(
    'diary_draft_mode',
    JSON.stringify({
      startedAt: new Date().toISOString(),
      data: {
        modeId: 'vulnerable_child',
        situation: '',
        thoughts: '',
        feelings: '',
        bodyFeelings: '',
        actions: '',
        actualNeed: '',
        childhoodMemories: '',
      },
    }),
  );
}

function renderSheet() {
  seedMode();
  render(<ModeEntrySheet onClose={() => {}} onSave={vi.fn()} />);
  return screen.getByPlaceholderText(/позвонил папа/);
}

describe('ModeEntrySheet — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе в поле «ситуация»', () => {
    const situation = renderSheet();
    fireEvent.change(situation, { target: { value: 'хочу умереть' } });
    expect(screen.getByText('8-800-2000-122')).toBeTruthy();
  });

  it('не показывает карточку при нейтральном тексте', () => {
    const situation = renderSheet();
    fireEvent.change(situation, {
      target: { value: 'сегодня гулял в парке' },
    });
    expect(screen.queryByText('8-800-2000-122')).toBeNull();
  });
});

// Journey D: после сохранения — итог, а не молчаливое закрытие («всё исчезло»).
describe('ModeEntrySheet — итог после сохранения (Journey D)', () => {
  function seedFilled() {
    localStorage.setItem(
      'diary_draft_mode',
      JSON.stringify({
        startedAt: new Date().toISOString(),
        data: {
          modeId: 'vulnerable_child',
          situation: 'позвонил папа',
          thoughts: '',
          feelings: '',
          bodyFeelings: '',
          actions: '',
          actualNeed: '',
          childhoodMemories: '',
          healthyResponse: '',
        },
      }),
    );
  }

  it('показывает «Запись сохранена» и НЕ закрывает шит', async () => {
    seedFilled();
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ModeEntrySheet onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByText('Сохранить запись'));
    await waitFor(() => expect(screen.getByText('Записано')).toBeTruthy());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled(); // итог, а не закрытие
  });
});

// Часть B (monitoring-modes-ux): подсказка «разобрать связанный режим» на
// экране «Запись сохранена» перезапускает визард про ту же ситуацию.
describe('ModeEntrySheet — рестарт цепочки после ModeChainSuggestion', () => {
  function seedCoping() {
    localStorage.setItem(
      'diary_draft_mode',
      JSON.stringify({
        startedAt: new Date().toISOString(),
        data: {
          modeId: 'detached_protector', // копинг → предложит Ребёнка
          situation: 'коллега накричал на созвоне',
          thoughts: '',
          feelings: '',
          bodyFeelings: '',
          actions: '',
          actualNeed: '',
          childhoodMemories: '',
          healthyResponse: '',
        },
      }),
    );
  }

  it('тап по кандидату открывает визард заново: ситуация на месте, режим сменился', async () => {
    seedCoping();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ModeEntrySheet onClose={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByText('Сохранить запись'));
    await waitFor(() => expect(screen.getByText('Записано')).toBeTruthy());

    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));

    // шаг записи снова открыт — прежняя ситуация на месте
    await waitFor(() =>
      expect(
        screen.getByDisplayValue('коллега накричал на созвоне'),
      ).toBeTruthy(),
    );
    expect(screen.queryByText('Записано')).toBeNull();
  });

  it('«Другой режим» возвращает на выбор режима с той же ситуацией', async () => {
    seedCoping();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ModeEntrySheet onClose={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByText('Сохранить запись'));
    await waitFor(() => expect(screen.getByText('Записано')).toBeTruthy());

    fireEvent.click(screen.getByText('Другой режим'));

    // назад на шаг 1 — список состояний обычными словами
    await waitFor(() =>
      expect(screen.getByText('Что ты сейчас чувствуешь?')).toBeTruthy(),
    );
    expect(screen.queryByText('Записано')).toBeNull();
  });
});
