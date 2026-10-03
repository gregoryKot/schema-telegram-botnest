// @vitest-environment jsdom
// Шторка «Помощь рядом» открывается без детекции в тексте — карточка в ней
// обязана быть постоянной (standing), а не «Похоже, сейчас очень тяжело».
// Регрессия 2026-10-03 (тот же класс, что CrisisBlock сайта).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CrisisSheet } from './CrisisSheet';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));

afterEach(() => cleanup());

describe('CrisisSheet', () => {
  it('нейтральный заголовок карточки, телефоны доверия на месте', () => {
    render(<CrisisSheet onClose={vi.fn()} />);
    expect(screen.getByText('Если станет совсем тяжело')).toBeTruthy();
    expect(screen.queryByText(/Похоже/)).toBeNull();
    expect(screen.getByText('8-800-100-49-94')).toBeTruthy();
  });
});
