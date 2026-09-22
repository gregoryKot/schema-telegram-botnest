import { useEffect } from 'react';
import { trackGoal } from '../../lib/metrika';

/**
 * Две цели лендинга: клик по ссылке на Telegram-автора и просмотр блока
 * цен. Цель booking_start считается отдельно, через trackGoalOnce —
 * см. LandingPage.scrollToBooking и BookingPicker.
 */
export function useLandingGoals(): void {
  useEffect(() => {
    // Делегированный слушатель на document, а не onClick на каждой ссылке:
    // на лендинге шесть ссылок на @kotlarewski в пяти разных файлах (шапка
    // hero «Написать», кнопка «Написать в Telegram», @kotlarewski в блоке
    // записи, футер, мобильное меню, тексты ошибок
    // BookingErrorNote/BookingPicker/BookingForm) — при onClick на каждой
    // забытая ссылка молча не считалась бы, а этот слушатель ловит и
    // будущие ссылки тоже.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href]');
      const href = link?.getAttribute('href');
      if (href?.startsWith('https://t.me/kotlarewski')) trackGoal('tg_click');
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const el = document.getElementById('prices');
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            trackGoal('prices_view');
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
}
