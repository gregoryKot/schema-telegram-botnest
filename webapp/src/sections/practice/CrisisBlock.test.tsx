// @vitest-environment jsdom
// Постоянная точка входа к кризисной помощи на «Практике» (дизайн-аудит
// 2026-08, В2 — CLAUDE.md правило №7). Проверяем то, что важно именно для
// «спасательного круга»: карточка отрисована, телефон доверия виден и
// кликабелен (реальный tel:-номер, не текст-заглушка).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CrisisBlock } from './CrisisBlock';
import { CRISIS_HOTLINE_DISPLAY, CRISIS_HOTLINE_TEL } from '../../utils/crisisMarkers';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

afterEach(() => {
  cleanup();
});

describe('CrisisBlock — постоянный «спасательный круг» на сайте', () => {
  it('заголовок и кризисная карточка видны', () => {
    render(<CrisisBlock />);
    expect(screen.getByText('Помощь рядом')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('телефон доверия виден и кликабелен (реальная tel:-ссылка)', () => {
    render(<CrisisBlock />);
    const link = screen.getByText(CRISIS_HOTLINE_DISPLAY).closest('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe(CRISIS_HOTLINE_TEL);
  });

  it('упоминает 112 и разговор с близким', () => {
    render(<CrisisBlock />);
    expect(screen.getByText(/112/)).toBeTruthy();
    expect(screen.getByText(/Разговор с близким человеком/)).toBeTruthy();
  });
});
