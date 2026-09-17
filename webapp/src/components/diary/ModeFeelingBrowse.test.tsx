// @vitest-environment jsdom
// Навигация «по ощущению» (webapp-двойник miniapp ModeFeelingBrowse.test.tsx,
// правило №3). Тап по чипу семьи раскрывает листы, тап по листу выбирает
// modeId. Данные — shared/mode/modeFeelGates (ворота «по базовым чувствам»),
// синхронность с MODE_GROUPS покрыта webapp modeTest.test.ts.
// mode_test_completed: событие переехало сюда из удалённого окна-теста
// (ModeTestScreen) — чипы теперь единственный вход выбора режима.
//
// Регресс (monitoring-modes-ux): при удалении окна-теста строка стала
// показывать имя режима крупно и label мелко, а desc и hint семьи пропали —
// новичок видел термин вместо тёплой фразы. Здесь фиксируем починку: label
// крупно, desc виден, hint семьи виден, имя режима — мелкая пометка-справка.
//
// Редизайн ворот-по-чувствам (monitoring-modes-ux-s8rzyd): ворота теперь
// только чувства, внутри — вопрос-уточнение (question) над hint.
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
    fireEvent.click(screen.getByText(/Страшно, тревожно/));
    expect(screen.getByText('Одиноко, страшно, грустно')).toBeTruthy();
  });

  it('раскрытие семьи показывает вопрос-уточнение и hint над списком режимов', () => {
    render(<ModeFeelingBrowse onPick={vi.fn()} />);
    fireEvent.click(screen.getByText(/Страшно, тревожно/));
    expect(screen.getByText('Про что этот страх?')).toBeTruthy();
    expect(
      screen.getByText('страх и тревога — сигналы уязвимого внутри'),
    ).toBeTruthy();
  });

  it('строка режима показывает desc и имя режима мелкой пометкой', () => {
    render(<ModeFeelingBrowse onPick={vi.fn()} />);
    fireEvent.click(screen.getByText(/Страшно, тревожно/));
    expect(
      screen.getByText(
        /Внутри — беззащитная детская часть, будто выбили опору/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText((_, node) => node?.textContent === '→ Уязвимый Ребёнок'),
    ).toBeTruthy();
  });

  it('тап по листу вызывает onPick с правильным modeId', () => {
    const onPick = vi.fn();
    render(<ModeFeelingBrowse onPick={onPick} />);
    fireEvent.click(screen.getByText(/Страшно, тревожно/));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    expect(onPick).toHaveBeenCalledWith('vulnerable_child');
  });

  it('клик по чипу «Пусто или не пойму, что чувствую» показывает лист «Пусто и ровно, как в вате» с desc, клик по нему вызывает onPick(detached_protector)', () => {
    const onPick = vi.fn();
    render(<ModeFeelingBrowse onPick={onPick} />);
    fireEvent.click(screen.getByText(/Пусто или не пойму, что чувствую/));
    expect(screen.getByText('Пусто и ровно, как в вате')).toBeTruthy();
    expect(
      screen.getByText(/Чувства будто выключили: внутри тихо, плоско/),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Пусто и ровно, как в вате'));
    expect(onPick).toHaveBeenCalledWith('detached_protector');
  });

  it('клик по режиму шлёт mode_test_completed с modeId', () => {
    render(<ModeFeelingBrowse onPick={vi.fn()} />);
    fireEvent.click(screen.getByText(/Страшно, тревожно/));
    fireEvent.click(screen.getByText('Одиноко, страшно, грустно'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith(MODE_TEST_COMPLETED_EVENT, {
      modeId: 'vulnerable_child',
    });
  });
});
