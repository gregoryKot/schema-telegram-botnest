// @vitest-environment jsdom
// Плитки главной: единственная кнопка экрана подписана по состоянию трекера,
// лепестки картинки красятся только у оценённых потребностей, каждая плитка
// зовёт свой обработчик.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeTiles, trackerCta } from './HomeTiles';

vi.mock('../../haptic', () => ({ haptic: { tap: vi.fn() } }));

const base = {
  ratings: {} as Record<string, number>,
  tracker: { filled: 0, total: 5, index: null },
  trackerMeta: 'Ещё не заполнен · ≈1 мин',
  caseMeta: '≈3 мин · когда что-то зацепило',
  diaryMeta: 'Пока записей нет',
  onTracker: vi.fn(),
  onCase: vi.fn(),
  onDiary: vi.fn(),
};

describe('trackerCta', () => {
  it('пусто → «Заполнить за минуту», частично → «Продолжить», всё → «Посмотреть сегодня»', () => {
    expect(trackerCta({ filled: 0, total: 5, index: null })).toBe('Заполнить за минуту');
    expect(trackerCta({ filled: 2, total: 5, index: null })).toBe('Продолжить');
    expect(trackerCta({ filled: 5, total: 5, index: 6 })).toBe('Посмотреть сегодня');
  });
  it('потребностей нет (ещё не загрузились) — не «Посмотреть», а «Заполнить»', () => {
    expect(trackerCta({ filled: 0, total: 0, index: null })).toBe('Заполнить за минуту');
  });
});

describe('HomeTiles', () => {
  it('главная плитка — кнопка с именем «Трекер», внутри одна залитая «кнопка»-подпись; заполненный трекер — вторичная', () => {
    const { rerender } = render(<HomeTiles {...base} />);
    const main = screen.getByRole('button', { name: /Трекер.*Заполнить за минуту/ });
    expect(main.querySelector('.ct-tile-cta')?.textContent).toBe('Заполнить за минуту');
    expect(main.querySelector('.ct-tile-cta')?.className).not.toContain('ds-btn--secondary');
    rerender(<HomeTiles {...base} tracker={{ filled: 5, total: 5, index: 6 }} />);
    expect(main.querySelector('.ct-tile-cta')?.className).toContain('ds-btn--secondary');
    expect(document.querySelectorAll('.ds-btn').length).toBe(1);
  });

  it('лепестки: оценённая потребность красится, остальные пустые', () => {
    render(<HomeTiles {...base} ratings={{ attachment: 4 }} />);
    const rated = document.querySelectorAll('[data-rated="yes"]');
    expect(rated.length).toBe(1);
    expect(rated[0].getAttribute('data-need')).toBe('attachment');
    expect(document.querySelectorAll('[data-rated="no"]').length).toBe(4);
  });

  it('три плитки зовут свои обработчики', () => {
    const onTracker = vi.fn(), onCase = vi.fn(), onDiary = vi.fn();
    render(<HomeTiles {...base} onTracker={onTracker} onCase={onCase} onDiary={onDiary} />);
    fireEvent.click(screen.getByRole('button', { name: /Трекер/ }));
    fireEvent.click(screen.getByRole('button', { name: /Что случилось/ }));
    fireEvent.click(screen.getByRole('button', { name: /Дневник/ }));
    expect(onTracker).toHaveBeenCalledTimes(1);
    expect(onCase).toHaveBeenCalledTimes(1);
    expect(onDiary).toHaveBeenCalledTimes(1);
  });

  it('дневники грузятся (null) — скелетон вместо выдуманной подписи', () => {
    render(<HomeTiles {...base} diaryMeta={null} />);
    expect(document.querySelector('.ct-tile-meta--skeleton')).toBeTruthy();
  });
});
