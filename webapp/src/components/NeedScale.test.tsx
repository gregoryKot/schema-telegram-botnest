// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NeedScale } from './NeedScale';

afterEach(() => cleanup());

describe('NeedScale', () => {
  it('рисует пять кнопок со словами и значением в aria-label', () => {
    render(<NeedScale value={undefined} hue={28} onChange={vi.fn()} label="Привязанность" />);
    expect(screen.getByRole('group', { name: 'Привязанность' })).toBeTruthy();
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual([
      'Совсем нет — 2 из 10',
      'Мало — 4 из 10',
      'Наполовину — 6 из 10',
      'В основном да — 8 из 10',
      'Полностью — 10 из 10',
    ]);
  });

  it('тап отдаёт чётное значение слова', () => {
    const onChange = vi.fn();
    render(<NeedScale value={undefined} hue={28} onChange={onChange} label="x" />);
    fireEvent.click(screen.getByRole('button', { name: /В основном да/ }));
    expect(onChange).toHaveBeenCalledWith(8);
    fireEvent.click(screen.getByRole('button', { name: /Совсем нет/ }));
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('старая оценка 1–10 подсвечивает ближайшее слово, без оценки нажатой нет', () => {
    const { rerender } = render(<NeedScale value={7} hue={28} onChange={vi.fn()} label="x" />);
    const pressed = () => screen.getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true');
    expect(pressed().map(b => b.getAttribute('aria-label'))).toEqual(['В основном да — 8 из 10']);
    rerender(<NeedScale value={3} hue={28} onChange={vi.fn()} label="x" />);
    expect(pressed().map(b => b.getAttribute('aria-label'))).toEqual(['Мало — 4 из 10']);
    rerender(<NeedScale value={undefined} hue={28} onChange={vi.fn()} label="x" />);
    expect(pressed()).toHaveLength(0);
  });

  it('пипсы: закрашено столько, каков порядковый номер ответа', () => {
    render(<NeedScale value={undefined} hue={28} onChange={vi.fn()} label="x" />);
    const filled = screen.getAllByRole('button').map(b => b.querySelectorAll('.ns-pip.is-on').length);
    expect(filled).toEqual([1, 2, 3, 4, 5]);
    expect(screen.getAllByRole('button')[0].querySelectorAll('.ns-pip')).toHaveLength(5);
  });

  it('вчерашняя оценка помечается словом «вчера» на ближайшем ответе, без неё пометки нет', () => {
    const { rerender } = render(<NeedScale value={8} hue={28} onChange={vi.fn()} label="x" yesterday={5} />);
    const marked = screen.getAllByRole('button').filter(b => b.textContent?.includes('вчера'));
    expect(marked.map(b => b.getAttribute('aria-label'))).toEqual(['Наполовину — 6 из 10']);
    rerender(<NeedScale value={8} hue={28} onChange={vi.fn()} label="x" />);
    expect(screen.queryByText('вчера')).toBeNull();
  });

  it('одна шкала: ни кнопки «0», ни ответа ниже 2 — «не оценено» не уходит на сервер', () => {
    const onChange = vi.fn();
    render(<NeedScale value={undefined} hue={28} onChange={onChange} label="x" />);
    screen.getAllByRole('button').forEach(b => fireEvent.click(b));
    expect(onChange.mock.calls.map(c => c[0])).toEqual([2, 4, 6, 8, 10]);
  });
});

describe('NeedScale: подписи-якоря', () => {
  it('подпись рисуется под словом по индексу, без подписи — только слово', () => {
    render(
      <NeedScale
       
        value={undefined}
        hue={28}
        label="Привязанность"
        onChange={() => {}}
        sublabels={['ничего не было', undefined, 'что-то было', undefined, 'были моменты']}
      />,
    );
    expect(screen.getByText('ничего не было')).toBeTruthy();
    expect(screen.getByText('были моменты')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Мало/ }).querySelector('.ns-word-sub')).toBeNull();
  });
});
