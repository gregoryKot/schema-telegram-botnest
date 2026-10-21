// @vitest-environment jsdom
// Онбординг трекера на сайте (паритет с мини-аппом, этап 3).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TrackerOnboarding } from './TrackerOnboarding';
import { TRACKER_ONBOARDING_KEY, TRACKER_ORIGIN_NOTE } from '../../../../shared/src/needs/trackerOnboarding';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('TrackerOnboarding', () => {
  it('новичок: показывает происхождение потребностей и проходит три шага до флага «видел»', () => {
    render(<TrackerOnboarding eligible />);
    expect(screen.getByText(TRACKER_ORIGIN_NOTE)).toBeTruthy();
    expect(screen.getByText('1 / 3')).toBeTruthy();
    fireEvent.click(screen.getByText('Далее →'));
    fireEvent.click(screen.getByText('Далее →'));
    expect(screen.getByText('Паттерн — через 3–5 дней')).toBeTruthy();
    fireEvent.click(screen.getByText('Понятно, начнём'));
    expect(screen.queryByText(TRACKER_ORIGIN_NOTE)).toBeNull();
    expect(localStorage.getItem(TRACKER_ONBOARDING_KEY)).toBe('1');
  });

  it('«Пропустить» закрывает и запоминает', () => {
    render(<TrackerOnboarding eligible />);
    fireEvent.click(screen.getByText('Пропустить'));
    expect(screen.queryByText(TRACKER_ORIGIN_NOTE)).toBeNull();
    expect(localStorage.getItem(TRACKER_ONBOARDING_KEY)).toBe('1');
  });

  it('уже есть оценки — не показывается', () => {
    render(<TrackerOnboarding eligible={false} />);
    expect(screen.queryByText(TRACKER_ORIGIN_NOTE)).toBeNull();
  });

  it('флаг «видел» уже стоит — не показывается', () => {
    localStorage.setItem(TRACKER_ONBOARDING_KEY, '1');
    render(<TrackerOnboarding eligible />);
    expect(screen.queryByText(TRACKER_ORIGIN_NOTE)).toBeNull();
  });
});
