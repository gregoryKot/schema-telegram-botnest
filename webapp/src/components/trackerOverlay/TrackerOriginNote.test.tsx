// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TrackerOriginNote } from './TrackerOriginNote';
import { TRACKER_ONBOARDING_KEY, TRACKER_ORIGIN_NOTE } from '../../../../shared/src/needs/trackerOnboarding';
import { glue } from '../../../../shared/src/utils/typo';
// Строка склеена glue при отрисовке (U+2011 в «схема-терапии»); NBSP сводит к пробелу нормализатор testing-library.
const NOTE = glue(TRACKER_ORIGIN_NOTE).replace(/\s+/g, ' ');

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('TrackerOriginNote', () => {
  it('новичок: показывает происхождение потребностей; «Понятно» закрывает и запоминает', () => {
    render(<TrackerOriginNote eligible />);
    expect(screen.getByText(NOTE)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    expect(screen.queryByText(NOTE)).toBeNull();
    expect(localStorage.getItem(TRACKER_ONBOARDING_KEY)).toBe('1');
  });

  it('после закрытия при новом открытии не показывается (флаг сохранён)', () => {
    const first = render(<TrackerOriginNote eligible />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    first.unmount();
    render(<TrackerOriginNote eligible />);
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('уже есть оценки — не показывается', () => {
    render(<TrackerOriginNote eligible={false} />);
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('флаг «видел» уже стоит — не показывается', () => {
    localStorage.setItem(TRACKER_ONBOARDING_KEY, '1');
    render(<TrackerOriginNote eligible />);
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});
