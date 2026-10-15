import { lazy, Suspense } from 'react';
import { BookingPaidSkeleton } from './BookingPaidSkeleton';
import { page } from './bookingPageStyles';

// Не в главном чанке: экран после оплаты нужен только вернувшимся с Robokassa.
const BookingPaidPage = lazy(() => import('../../pages/BookingPaidPage').then(m => ({ default: m.BookingPaidPage })));

/** Пока грузится чанк — силуэт в той же обёртке, что у страницы, без скачка раскладки. */
export function BookingPaidRoute() {
  return (
    <Suspense fallback={<div style={page}><div style={{ width: '100%', maxWidth: 400 }}><BookingPaidSkeleton /></div></div>}>
      <BookingPaidPage />
    </Suspense>
  );
}
