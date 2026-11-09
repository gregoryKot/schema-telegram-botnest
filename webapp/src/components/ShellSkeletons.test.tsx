// @vitest-environment jsdom
// Силуэты разделов (b04): по адресу — силуэт того экрана, что откроется (не три серые карточки на
// всё), без текста и выдуманных данных: знак трекера — пустыми полосками, как у неоценённого дня.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MobileNavSkeleton, SectionSkeleton } from './ShellSkeletons';

const shape = (pathname: string, therapistMode = false) =>
  render(<SectionSkeleton pathname={pathname} therapistMode={therapistMode} />).container.firstElementChild!;

describe('SectionSkeleton', () => {
  it.each([
    ['/today', false, 'today-skeleton'],
    ['/more', false, 'more-skeleton'],
    ['/cabinet/today', true, 'therapist-today-skeleton'],
    ['/cabinet/annapeka', true, 'client-card-skeleton'],
    ['/cabinet/annapeka/concept', true, 'client-card-skeleton'],
  ])('%s → %s', (path, therapist, testId) => {
    expect(shape(path, therapist).getAttribute('data-testid')).toBe(testId);
  });

  it.each([['/diary', false], ['/profile', false], ['/cabinet', true], ['/cabinet/guide', true], ['/cabinet/tasks', true]])(
    '%s → общий силуэт раздела во всю ширину колонки', (path, therapist) => {
      const el = shape(path, therapist);
      expect(el.getAttribute('data-testid')).toBeNull();
      expect(el.classList.contains('sks-screen')).toBe(true);
    });

  it('«Сегодня»: знак трекера пустыми полосками — пять мест, ни одной оценки', () => {
    const marks = shape('/today').querySelectorAll('svg.pp-art rect');
    expect(marks).toHaveLength(5);
    expect(Array.from(marks).every(r => r.getAttribute('data-rated') === 'no')).toBe(true);
  });

  it('в силуэтах нет текста — только плашки', () => {
    for (const [p, t] of [['/today', false], ['/more', false], ['/cabinet/today', true], ['/cabinet/x1', true]] as const) {
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
