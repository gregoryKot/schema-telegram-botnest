// @vitest-environment jsdom
// Навигация «по ощущению» (webapp-двойник miniapp ModeFeelingBrowse.test.tsx,
// правило №3). Тап по чипу семьи раскрывает листы, тап по листу выбирает
// modeId. Данные — те же shared/mode/modeTest, синхронность с MODE_GROUPS
// покрыта webapp modeTest.test.ts.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeFeelingBrowse } from './ModeFeelingBrowse';

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
});
