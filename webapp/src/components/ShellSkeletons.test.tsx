// @vitest-environment jsdom
// Силуэты разделов (b04): по адресу — силуэт того экрана, что откроется (не три серые карточки на
// всё), без текста и выдуманных данных: знак трекера — пустыми полосками, как у неоценённого дня.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MobileNavSkeleton, SectionSkeleton } from './ShellSkeletons';
import { QUICK_LOOK } from './practice/quickLook';
import { PRACTICE_LOOK } from '../sections/practice/practiceLook';

const shape = (pathname: string, therapistMode = false) =>
  render(<SectionSkeleton pathname={pathname} therapistMode={therapistMode} />).container.firstElementChild!;

describe('SectionSkeleton', () => {
  it.each([
    ['/today', false, 'today-skeleton'],
    ['/more', false, 'more-skeleton'],
    ['/diary', false, 'diary-skeleton'],
    ['/practice', false, 'practice-skeleton'],
    ['/cabinet/today', true, 'therapist-today-skeleton'],
    ['/cabinet/annapeka', true, 'client-card-skeleton'],
    ['/cabinet/annapeka/concept', true, 'client-card-skeleton'],
  ])('%s → %s', (path, therapist, testId) => {
    expect(shape(path, therapist).getAttribute('data-testid')).toBe(testId);
  });

  it.each([['/profile', false], ['/cabinet', true], ['/cabinet/guide', true], ['/cabinet/tasks', true]])(
    '%s → общий силуэт раздела во всю ширину колонки', (path, therapist) => {
      const el = shape(path, therapist);
      expect(el.getAttribute('data-testid')).toBeNull();
      expect(el.classList.contains('sks-screen')).toBe(true);
    });

  it('«Практики»: герой дыхания на бумаге дыхания, квадраты по порядку раздела, бенто без оттенка', () => {
    const el = shape('/practice');
    const hue = (n: Element | null) => (n as HTMLElement | null)?.style.getPropertyValue('--h');
    expect(hue(el.querySelector('.cpk-hero'))).toBe(String(QUICK_LOOK.breathing.hue));
    const squares = [PRACTICE_LOOK.grounding, PRACTICE_LOOK.stop, PRACTICE_LOOK.sos].map((l) => String(l.hue));
    expect(Array.from(el.querySelectorAll('.cpk-squares > .pp-square'), hue)).toEqual(squares);
    const tiles = el.querySelectorAll('.cpk-lib > .cpk-ex');
    expect(tiles.length).toBeGreaterThan(0);
    expect(Array.from(tiles).every((t) => !t.classList.contains('pp-paper') && hue(t) === '')).toBe(true);
  });

  it('«Сегодня»: знак трекера пустыми полосками — пять мест, ни одной оценки', () => {
    const marks = shape('/today').querySelectorAll('svg.pp-art rect');
    expect(marks).toHaveLength(5);
    expect(Array.from(marks).every(r => r.getAttribute('data-rated') === 'no')).toBe(true);
  });

  it('в силуэтах нет текста — только плашки', () => {
    for (const [p, t] of [['/today', false], ['/more', false], ['/practice', false], ['/cabinet/today', true], ['/cabinet/x1', true]] as const) {
      expect(shape(p, t).textContent).toBe('');
    }
  });
});

describe('MobileNavSkeleton', () => {
  it('три места у клиента, пять у терапевта — как у настоящей панели', () => {
    expect(render(<MobileNavSkeleton therapist={false} />).container.querySelectorAll('.sks-mobile-nav-item')).toHaveLength(3);
    expect(render(<MobileNavSkeleton therapist />).container.querySelectorAll('.sks-mobile-nav-item')).toHaveLength(5);
  });
});
