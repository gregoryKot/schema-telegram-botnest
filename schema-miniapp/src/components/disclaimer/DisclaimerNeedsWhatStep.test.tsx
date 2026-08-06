// @vitest-environment jsdom
// DisclaimerNeedsWhatStep — первый содержательный шаг онбординга: пять
// потребностей (0% покрытия). Проверяем, что источник данных — NEEDS_EXPLAINER
// (общий с AboutSheet, «третьей формулировки не заводим» из комментария файла)
// и что все пять чипов отрисованы, а не часть списка.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DisclaimerNeedsWhatStep } from './DisclaimerNeedsWhatStep';
import { NEEDS_EXPLAINER } from '../../aboutData';

afterEach(() => {
  cleanup();
});

describe('DisclaimerNeedsWhatStep', () => {
  it('рендерит все потребности из NEEDS_EXPLAINER по имени', () => {
    render(<DisclaimerNeedsWhatStep />);
    for (const n of NEEDS_EXPLAINER) {
      expect(screen.getByText(n.name)).toBeTruthy();
    }
  });

  it('заголовок шага на месте', () => {
    render(<DisclaimerNeedsWhatStep />);
    expect(screen.getByText('Пять базовых потребностей')).toBeTruthy();
  });
});
