// @vitest-environment jsdom
// Навигация «по ощущению» (Часть A задачи monitoring-modes-ux): тап по чипу
// семьи раскрывает её листы, тап по листу выбирает конкретный modeId.
// Переиспользует данные теста modeTest.ts — синхронность с MODE_GROUPS уже
// покрыта modeTest.test.ts, здесь проверяем только взаимодействие.
// mode_test_completed: событие переехало сюда из удалённого окна-теста
// (ModeTestSheet) — чипы теперь единственный вход выбора режима.
//
// Регресс (monitoring-modes-ux): при удалении окна-теста строка стала
// показывать имя режима крупно и label мелко, а desc и hint семьи пропали —
// новичок видел термин вместо тёплой фразы. Здесь фиксируем починку: label
// крупно, desc виден, hint семьи виден, имя режима — мелкая пометка-справка.
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

describe('ModeFeelingBrowse', () => {
  it('листы семьи скрыты, пока семья не раскрыта тапом', () => {
    render(<ModeFeelingBrowse onChange={vi.fn()} />);
    expect(screen.queryByText('Одиноко, страшно, грустно')).toBeNull();
  });

  it('тап по чипу семьи показывает её листы', () => {
    render(<ModeFeelingBrowse onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Мне больно, страшно, одиноко/));
    expect(screen.getByText('Одиноко, страшно, грустно')).toBeTruthy();
  });

  it('раскрытие семьи показывает её hint над списком режимов', () => {
    render(<ModeFeelingBrowse onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Мне больно, страшно, одиноко/));
    expect(
      screen.getByText('детская боль — нужна забота и присутствие'),
    ).toBeTruthy();
  });

  it('строка режима показывает desc и имя режима мелкой пометкой', () => {
    render(<ModeFeelingBrowse onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Мне больно, страшно, одиноко/));
    // desc — тёплое описание из данных (уже было в ModeTestLeaf, потерялось при регрессе).
    expect(
      screen.getByText(
        /Внутри — беззащитная детская часть, будто выбили опору/,
      ),
    ).toBeTruthy();
    // имя режима присутствует как мелкая пометка-справка «→ Имя».
    expect(
      screen.getByText((_, node) => node?.textContent === '→ Уязвимый Ребёнок'),
    ).toBeTruthy();
  });

  it('тап по листу вызывает onChange с правильным modeId', () => {
    const onChange = vi.fn();
    render(<ModeFeelingBrowse onChange={onChange} />);
    fireEvent.click(screen.getByText(/Мне больно, страшно, одиноко/));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    expect(onChange).toHaveBeenCalledWith('vulnerable_child');
  });

  it('повторный тап по открытой семье сворачивает список', () => {
    render(<ModeFeelingBrowse onChange={vi.fn()} />);
    const chip = screen.getByText(/Мне больно, страшно, одиноко/);
    fireEvent.click(chip);
    expect(screen.getByText('Одиноко, страшно, грустно')).toBeTruthy();
    fireEvent.click(chip);
    expect(screen.queryByText('Одиноко, страшно, грустно')).toBeNull();
  });

  it('клик по чипу «Не знаю, что чувствую, или пусто» показывает лист «Пусто и ровно, как в вате» с desc, клик по нему выбирает detached_protector', () => {
    const onChange = vi.fn();
    render(<ModeFeelingBrowse onChange={onChange} />);
    fireEvent.click(screen.getByText(/Не знаю, что чувствую, или пусто/));
    expect(screen.getByText('Пусто и ровно, как в вате')).toBeTruthy();
    expect(
      screen.getByText(/Чувства будто выключили: внутри тихо, плоско/),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Пусто и ровно, как в вате'));
    expect(onChange).toHaveBeenCalledWith('detached_protector');
  });

  it('клик по режиму шлёт mode_test_completed с modeId', () => {
    render(<ModeFeelingBrowse onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Мне больно, страшно, одиноко/));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith(MODE_TEST_COMPLETED_EVENT, {
      modeId: 'vulnerable_child',
    });
  });
});
