// @vitest-environment jsdom
// Прямой тест тела карточки (правило №7 CLAUDE.md: свободный текст = кризисный
// путь + правило №8: аналитика). Обёртки фронтендов (webapp/CrisisCard.tsx,
// schema-miniapp/CrisisCard.tsx) тестируют только прокидывание tr/track —
// сама механика показа/клика/двух форм обращения тестируется здесь один раз.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CrisisCardView } from './CrisisCard';
import {
  CRISIS_HOTLINE_DISPLAY,
  CRISIS_HOTLINE_TEL,
} from '../utils/crisisMarkers';

const tr = (ty: string, vy: string) => `${ty}|${vy}`;

afterEach(() => {
  cleanup();
});

describe('CrisisCardView — рендер', () => {
  it('role="status", телефон доверия и его tel-ссылка видны', () => {
    render(<CrisisCardView surface="note" tr={tr} track={vi.fn()} />);
    expect(screen.getByRole('status')).toBeTruthy();
    const link = screen.getByText(CRISIS_HOTLINE_DISPLAY);
    expect(link.getAttribute('href')).toBe(CRISIS_HOTLINE_TEL);
  });

  it('обе формы обращения (ты/вы) присутствуют в тексте через tr()', () => {
    render(<CrisisCardView surface="note" tr={tr} track={vi.fn()} />);
    // tr() вызван ровно с двумя вариантами, объединёнными для проверки —
    // сама вилка ты/вы держится на месте использования (в компоненте), здесь
    // фиксируем, что оба переданных текста реально попали в разметку.
    expect(screen.getByText((content) => content.includes('|'))).toBeTruthy();
  });
});

describe('CrisisCardView — аналитика (правило №8)', () => {
  it('с surface: при маунте трекает crisis_card_shown с {surface}', () => {
    const track = vi.fn();
    render(<CrisisCardView surface="diary_schema" tr={tr} track={track} />);
    expect(track).toHaveBeenCalledWith('crisis_card_shown', {
      surface: 'diary_schema',
    });
  });

  it('без surface: маунт НЕ трекает (постоянная карточка помощи не засоряет метрику)', () => {
    const track = vi.fn();
    render(<CrisisCardView tr={tr} track={track} />);
    expect(track).not.toHaveBeenCalled();
  });

  it('клик по телефону доверия трекает crisis_hotline_tapped с тем же surface', () => {
    const track = vi.fn();
    render(<CrisisCardView surface="letter" tr={tr} track={track} />);
    track.mockClear();
    fireEvent.click(screen.getByText(CRISIS_HOTLINE_DISPLAY));
    expect(track).toHaveBeenCalledWith('crisis_hotline_tapped', {
      surface: 'letter',
    });
  });

  it('клик без surface ничего не трекает', () => {
    const track = vi.fn();
    render(<CrisisCardView tr={tr} track={track} />);
    fireEvent.click(screen.getByText(CRISIS_HOTLINE_DISPLAY));
    expect(track).not.toHaveBeenCalled();
  });
});
