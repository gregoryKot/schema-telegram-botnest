import { Skeleton } from '../Skeleton';

/** Силуэт экрана возврата с оплаты, пока грузится бронь: значок, заголовок, текст, карточка. */
export function BookingPaidSkeleton() {
  return (
    <div aria-hidden style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-12)' }}>
      <Skeleton width={56} height={56} radius={28} />
      <Skeleton width="60%" height={30} />
      <Skeleton width="85%" height={14} />
      <Skeleton height={72} radius={14} style={{ marginTop: 8 }} />
    </div>
  );
}
