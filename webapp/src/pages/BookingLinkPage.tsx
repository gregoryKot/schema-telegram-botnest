import { lazy, Suspense, useEffect } from 'react';
import type { BookingType } from '../components/BookingPicker';
import { backLink, h1, page, sub } from '../components/booking/bookingPageStyles';
import { linkBtn } from '../components/booking/linkButtonStyle';
import { SlotsLoadingNote } from '../components/booking/SlotsLoadingNote';
import { useNoIndex } from '../hooks/useNoIndex';
import { trackGoalOnce } from '../lib/metrika';
import { siteTitleSuffix } from '../utils/domainChrome';
import { TG_URL } from './landing/constants';

// Лениво, как на лендинге: пикер с экранами оплаты не нужен в главном чанке сайта.
const BookingPicker = lazy(() => import('../components/BookingPicker').then((m) => ({ default: m.BookingPicker })));

/** `?type=intro` → знакомство; всё остальное — сессия: ссылку получают уже знакомые клиенты. */
function bookingTypeFromSearch(search: string): BookingType {
  return new URLSearchParams(search).get('type') === 'intro' ? 'INTRO_15' : 'SESSION_50';
}

function TgNote({ lead }: { lead: string }) {
  return (
    <p style={{ fontSize: 14, color: 'var(--text-faint)', lineHeight: 1.6, margin: 0 }}>
      {lead} <a href={TG_URL} target="_blank" rel="noopener noreferrer" style={linkBtn}>Напишите мне в Telegram</a> – подберём вместе.
    </p>
  );
}

/**
 * Постоянная ссылка для клиентов практики (kotlarewski.gr/book): расписание
 * открыто сразу, без формы «напишите мне» и без кнопки «Открыть расписание».
 * Узкая версия «Расписания для клиента» (#546) — без входа и аккаунта.
 */
export function BookingLinkPage() {
  useNoIndex();
  useEffect(() => {
    document.title = `Выберите удобное время | ${siteTitleSuffix()}`;
    trackGoalOnce('booking_link_open');
  }, []);
  const defaultType = bookingTypeFromSearch(window.location.search);

  return (
    <div style={{ ...page, alignItems: 'flex-start' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <h1 style={h1}>Выберите удобное время</h1>
        <p style={sub}>
          Знакомство подтверждается сразу, сессия – после оплаты. Ссылку на видеовстречу пришлю на контакт, который вы укажете.
        </p>
        <Suspense fallback={<SlotsLoadingNote />}>
          <BookingPicker defaultType={defaultType} fallback={<TgNote lead="Открытого времени сейчас нет." />} />
        </Suspense>
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
          <TgNote lead="Не нашли время?" />
        </div>
        <a href="/" style={backLink}>← На главную</a>
      </div>
    </div>
  );
}
