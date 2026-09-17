// @vitest-environment jsdom
// ReviewsPage — страница-объяснение, почему на сайте нет отзывов клиентов
// (0% покрытия, этически значимый текст). Проверяем, что все 4 причины
// рендерятся и CTA на знакомство ведёт на реальный урл записи.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ReviewsPage } from './ReviewsPage';
import { PRACTICE_BOOKING_URL } from './landing/constants';

afterEach(() => {
  cleanup();
});

describe('ReviewsPage', () => {
  it('рендерит заголовок и все 4 причины отсутствия отзывов', () => {
    render(<ReviewsPage />);
    expect(screen.getByText('Отзывы')).toBeTruthy();
    expect(screen.getByText('Сам факт обращения – тайна')).toBeTruthy();
    expect(screen.getByText('Просьба об отзыве – это давление')).toBeTruthy();
    expect(screen.getByText('Так велят профессиональные стандарты')).toBeTruthy();
    expect(screen.getByText('Отзывы создают ложные ожидания')).toBeTruthy();
  });

  it('CTA «Записаться на знакомство» ведёт на реальный урл записи, не заглушку', () => {
    render(<ReviewsPage />);
    const cta = screen.getByText('Записаться на знакомство →') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe(PRACTICE_BOOKING_URL);
  });
});
