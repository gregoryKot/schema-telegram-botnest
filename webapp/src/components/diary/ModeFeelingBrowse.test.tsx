// @vitest-environment jsdom
// Навигация «по ощущению» (webapp-двойник miniapp ModeFeelingBrowse.test.tsx,
// правило №3). Тап по чипу семьи раскрывает листы, тап по листу выбирает
// modeId. Данные — те же shared/mode/modeTest, синхронность с MODE_GROUPS
// покрыта webapp modeTest.test.ts.
// mode_test_completed: событие переехало сюда из удалённого окна-теста
// (ModeTestScreen) — чипы теперь единственный вход выбора режима.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeFeelingBrowse } from './ModeFeelingBrowse';
import { MODE_TEST_COMPLETED_EVENT } from '../../../../shared/src/share/analytics';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe('ModeFeelingBrowse (webapp)', () => {
  it('листы семьи скрыты, пока семья не раскрыта тапом', () => {
    render(<ModeFeelingBrowse onPick={vi.fn()} />);
    expect(screen.queryByText('Одиноко, страшно, грустно')).toBeNull();
  });

  it('тап по чипу семьи показывает её листы', () => {
    render(<ModeFeelingBrowse onPick={vi.fn()} />);
    fireEvent.click(screen.getByText(/Мне больно, страшно, одиноко/));
    expect(screen.getByText('Одиноко, страшно, грустно')).toBeTruthy();
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
  });

  it('тап по листу вызывает onPick с правильным modeId', () => {
    const onPick = vi.fn();
    render(<ModeFeelingBrowse onPick={onPick} />);
    fireEvent.click(screen.getByText(/Мне больно, страшно, одиноко/));
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    expect(onPick).toHaveBeenCalledWith('vulnerable_child');
  });

  it('клик по чипу «Не знаю, что чувствую, или пусто» показывает лист «Пусто и ровно, как в вате», клик по нему вызывает onPick(detached_protector)', () => {
    const onPick = vi.fn();
    render(<ModeFeelingBrowse onPick={onPick} />);
    fireEvent.click(screen.getByText(/Не знаю, что чувствую, или пусто/));
    expect(screen.getByText('Пусто и ровно, как в вате')).toBeTruthy();
    fireEvent.click(screen.getByText('Пусто и ровно, как в вате'));
    expect(onPick).toHaveBeenCalledWith('detached_protector');
  });

  it('клик по режиму шлёт mode_test_completed с modeId', () => {
    render(<ModeFeelingBrowse onPick={vi.fn()} />);
    fireEvent.click(screen.getByText(/Мне больно, страшно, одиноко/));
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith(MODE_TEST_COMPLETED_EVENT, {
      modeId: 'vulnerable_child',
    });
  });
});
