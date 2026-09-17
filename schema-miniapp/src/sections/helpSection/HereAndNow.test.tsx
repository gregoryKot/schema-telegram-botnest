// @vitest-environment jsdom
// Блок «Здесь и сейчас»: подпись строки-практики берётся из РЕАЛЬНОГО счётчика
// прохождений, а пока счётчика нет (не загрузился или запрос упал) — остаётся
// статичная подпись, а не выдуманный ноль (правило CLAUDE.md «никаких
// хардкод-заглушек вместо реальных данных»). Второй класс — «строка открывает
// свою практику»: заземление и «Стоп» ходят через один overlays.show, и
// перепутанный id здесь означал бы, что кнопка открывает не ту практику.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HereAndNow } from './HereAndNow';
import type { HelpOverlaysState } from './useHelpOverlays';

// BreathingCard ходит в api за своим счётчиком и проверяется отдельно
// (shared/practices/BreathingCard + обёртки обеих площадок) — здесь заглушка,
// чтобы тест блока не превращался в тест карточки дыхания.
vi.mock('../../components/BreathingCard', () => ({
  BreathingCard: () => <div data-testid="breathing-card" />,
}));

afterEach(() => cleanup());

function renderBlock(
  practiceCounts: Parameters<typeof HereAndNow>[0]['practiceCounts'],
) {
  const show = vi.fn();
  const overlays = { show } as unknown as HelpOverlaysState;
  render(<HereAndNow overlays={overlays} practiceCounts={practiceCounts} />);
  return show;
}

describe('HereAndNow', () => {
  it('счётчиков ещё нет — у обеих строк статичная подпись, без нуля', () => {
    renderBlock(null);
    expect(screen.getByText('вернуться в тело и в комнату')).toBeTruthy();
    expect(screen.getByText('пауза между импульсом и действием')).toBeTruthy();
    expect(screen.queryByText(/прошли/)).toBeNull();
  });

  it('счётчик = 0 — тоже статичная подпись, а не «прошли 0 раз»', () => {
    renderBlock({ breathing: 0, grounding: 0, stop: 0 });
    expect(screen.getByText('вернуться в тело и в комнату')).toBeTruthy();
    expect(screen.queryByText(/прошли/)).toBeNull();
  });

  it('реальные счётчики видны у своей строки, каждый со своим числом', () => {
    renderBlock({ breathing: 9, grounding: 3, stop: 1 });
    expect(screen.getByText('прошли 3 раза')).toBeTruthy();
    expect(screen.getByText('прошли 1 раз')).toBeTruthy();
    // Счётчик дыхания живёт в самой карточке, в список он не подмешивается.
    expect(screen.queryByText('прошли 9 раз')).toBeNull();
  });

  it('строка заземления открывает заземление, строка «Стоп» — «Стоп»', () => {
    const show = renderBlock(null);
    fireEvent.click(screen.getByText('Заземление 5-4-3-2-1'));
    expect(show).toHaveBeenCalledWith('grounding');
    fireEvent.click(screen.getByText('Техника «Стоп»'));
    expect(show).toHaveBeenCalledWith('stop');
  });

  it('«Мне очень плохо» ведёт к кризисным контактам', () => {
    const show = renderBlock(null);
    fireEvent.click(screen.getByText('Мне очень плохо'));
    expect(show).toHaveBeenCalledWith('crisis');
  });
});
