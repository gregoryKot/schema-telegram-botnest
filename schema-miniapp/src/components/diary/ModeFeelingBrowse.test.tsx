// @vitest-environment jsdom
// Навигация «по ощущению» (Часть A задачи monitoring-modes-ux): тап по чипу
// семьи раскрывает её листы, тап по листу выбирает конкретный modeId.
// Переиспользует данные теста modeTest.ts — синхронность с MODE_GROUPS уже
// покрыта modeTest.test.ts, здесь проверяем только взаимодействие.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeFeelingBrowse } from './ModeFeelingBrowse';

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
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
  });

  it('тап по листу вызывает onChange с правильным modeId', () => {
    const onChange = vi.fn();
    render(<ModeFeelingBrowse onChange={onChange} />);
    fireEvent.click(screen.getByText(/Мне больно, страшно, одиноко/));
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
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

  it('клик по чипу «Не знаю, что чувствую, или пусто» показывает лист «Пусто и ровно, как в вате», клик по нему выбирает detached_protector', () => {
    const onChange = vi.fn();
    render(<ModeFeelingBrowse onChange={onChange} />);
    fireEvent.click(screen.getByText(/Не знаю, что чувствую, или пусто/));
    expect(screen.getByText('Пусто и ровно, как в вате')).toBeTruthy();
    fireEvent.click(screen.getByText('Пусто и ровно, как в вате'));
    expect(onChange).toHaveBeenCalledWith('detached_protector');
  });
});
