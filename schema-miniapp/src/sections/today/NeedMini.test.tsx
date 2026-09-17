// @vitest-environment jsdom
// Мини-карточка потребности на экране трекера (CLAUDE.md — приоритет
// покрытия «экраны трекера и оценки потребностей»). Поведение: пустое
// состояние (цветная точка потребности, не выдуманное число), заполненное
// значение, дельта к вчера, клик/клавиатура открывают оценку.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NeedMini } from './NeedMini';
import { Need } from '../../types';

afterEach(() => {
  cleanup();
});

const NEED: Need = {
  id: 'autonomy',
  emoji: '🧭',
  title: 'Автономия',
  chartLabel: 'Автономия',
};

describe('NeedMini', () => {
  it('нет оценки за сегодня — показывает точку цвета потребности, не число (пустое состояние)', () => {
    const { container } = render(
      <NeedMini need={NEED} value={undefined} onTap={() => {}} />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });

  it('есть оценка за сегодня — показывает число', () => {
    render(<NeedMini need={NEED} value={7} onTap={() => {}} />);
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('оценка выросла по сравнению со вчера — показывает зелёную дельту +N', () => {
    render(<NeedMini need={NEED} value={7} yesterday={4} onTap={() => {}} />);
    expect(screen.getByText('+3')).toBeTruthy();
  });

  it('оценка снизилась по сравнению со вчера — показывает дельту без плюса', () => {
    render(<NeedMini need={NEED} value={3} yesterday={6} onTap={() => {}} />);
    expect(screen.getByText('-3')).toBeTruthy();
  });

  it('оценка не изменилась — дельта не показывается', () => {
    render(<NeedMini need={NEED} value={5} yesterday={5} onTap={() => {}} />);
    expect(screen.queryByText('+0')).toBeNull();
    expect(screen.queryByText('0', { exact: true })).toBeNull();
  });

  it('нет сегодняшней оценки — дельта не считается, даже если вчера было значение', () => {
    render(
      <NeedMini need={NEED} value={undefined} yesterday={5} onTap={() => {}} />,
    );
    expect(screen.queryByText(/^[+-]\d+$/)).toBeNull();
  });

  it('клик вызывает onTap', () => {
    const onTap = vi.fn();
    render(<NeedMini need={NEED} value={5} onTap={onTap} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('клавиша Enter вызывает onTap', () => {
    const onTap = vi.fn();
    render(<NeedMini need={NEED} value={5} onTap={onTap} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('клавиша Space вызывает onTap, другая клавиша — нет', () => {
    const onTap = vi.fn();
    render(<NeedMini need={NEED} value={5} onTap={onTap} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' });
    expect(onTap).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
