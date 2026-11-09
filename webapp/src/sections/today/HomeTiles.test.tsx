// @vitest-environment jsdom
// Плитки главной: единственная кнопка экрана подписана по состоянию трекера,
// лепестки картинки красятся только у оценённых потребностей, каждая плитка
// зовёт свой обработчик.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { HomeTiles } from './HomeTiles';
import { trackerCta } from './trackerCta';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';

vi.mock('../../haptic', () => ({ haptic: { tap: vi.fn() } }));

const base = {
  ratings: {} as Record<string, number>,
  tracker: { filled: 0, total: 5, index: null },
  trackerMeta: 'Ещё не заполнен · ≈1 мин',
  caseMeta: '≈3 мин',
  diaryMeta: 'Пока записей нет',
  onTracker: vi.fn(),
  onCase: vi.fn(),
  onDiary: vi.fn(),
};

describe('trackerCta', () => {
  it('пусто → «Отметить состояние», частично → «Продолжить», всё → «Посмотреть сегодня»', () => {
    expect(trackerCta({ filled: 0, total: 5, index: null })).toBe('Отметить состояние');
    expect(trackerCta({ filled: 2, total: 5, index: null })).toBe('Продолжить');
    expect(trackerCta({ filled: 5, total: 5, index: 6 })).toBe('Посмотреть сегодня');
  });
  it('потребностей нет (ещё не загрузились) — не «Посмотреть», а «Отметить»', () => {
    expect(trackerCta({ filled: 0, total: 0, index: null })).toBe('Отметить состояние');
  });
});

describe('HomeTiles', () => {
  it('блок трекера — кнопка с именем «Трекер … Отметить состояние», внутри одна залитая «кнопка»-подпись; заполненный трекер — вторичная', () => {
    const { rerender } = render(<HomeTiles {...base} />);
    const main = screen.getByRole('button', { name: /Трекер.*Отметить состояние/ });
    expect(main.querySelector('.pp-cta')?.textContent).toBe('Отметить состояние →');
    expect(main.querySelector('.pp-cta')?.className).not.toContain('ds-btn--secondary');
    rerender(<HomeTiles {...base} tracker={{ filled: 5, total: 5, index: 6 }} />);
    expect(main.querySelector('.pp-cta')?.className).toContain('ds-btn--secondary');
    expect(document.querySelectorAll('.ds-btn').length).toBe(1);
  });

  it('вопрос трекера звучит в форме обращения: «ты» и «вы»', () => {
    const { unmount } = render(<HomeTiles {...base} />);
    expect(screen.getByText('Как ты сегодня?')).toBeTruthy();
    unmount();
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
        <HomeTiles {...base} />
      </AddressFormContext.Provider>,
    );
    expect(screen.getByText('Как вы сегодня?')).toBeTruthy();
  });

  // b05: полоски дня — Strokes values (высота по оценке), рисунок верхнего слоя знака с тенью-вырезкой.
  const top = (sel: string) => document.querySelectorAll(`.ct-strokes > svg:last-child ${sel}`);

  it('полоски: у оценённой потребности — высота по оценке, остальные — пустое место', () => {
    render(<HomeTiles {...base} ratings={{ attachment: 4 }} />);
    const rated = top('[data-rated="yes"]');
    expect(rated.length).toBe(1);
    expect(rated[0].getAttribute('data-value')).toBe('4');
    expect([...top('rect')].indexOf(rated[0])).toBe(0);
    expect(top('[data-rated="no"]').length).toBe(4);
  });

  it('пустой день — пять пустых мест, ни одной выдуманной оценки', () => {
    render(<HomeTiles {...base} />);
    expect(top('[data-rated="yes"]').length).toBe(0);
    expect(top('[data-rated="no"]').length).toBe(5);
  });

  // Аудит 2026-11, E4: 0 — «не оценено» (откат отклонённой оценки), полоска не плотная.
  it('оценка 0 — пустое место, как без оценки', () => {
    render(<HomeTiles {...base} ratings={{ attachment: 0, autonomy: 6 }} />);
    expect([...top('[data-rated="yes"]')].map((r) => r.getAttribute('data-value'))).toEqual(['6']);
  });

  it('квадраты — бумага и знак своей сущности из ENTITY_LOOK', () => {
    render(<HomeTiles {...base} />);
    const hue = (name: RegExp) => screen.getByRole('button', { name }).style.getPropertyValue('--h');
    expect(hue(/Что случилось/)).toBe(String(ENTITY_LOOK.case.hue));
    expect(hue(/Дневник/)).toBe(String(ENTITY_LOOK.diary.hue));
    expect(hue(/Трекер/)).toBe(String(ENTITY_LOOK.tracker.hue));
    expect(screen.getByRole('button', { name: /Дневник/ }).querySelector('svg.pp-art--square')).toBeTruthy();
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
    expect(document.querySelector('.pp-meta--skeleton')).toBeTruthy();
  });
});
