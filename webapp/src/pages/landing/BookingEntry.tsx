import { lazy, Suspense, useState } from 'react';
import { linkBtn } from '../../components/booking/linkButtonStyle';
import { OPERATOR_EMAIL } from '../../legal/operator';
import { trackGoalOnce } from '../../lib/metrika';
import { BookingForm } from './BookingForm';
import { TgLink } from './nav';

// Лениво: пикер слотов (и его экраны оплаты/результата) не нужен, пока
// посетитель не открыл расписание — в главный чанк сайта он не попадает.
const BookingPicker = lazy(() => import('../../components/BookingPicker').then((m) => ({ default: m.BookingPicker })));

function NoSlotsNote({ onWrite }: { onWrite: () => void }) {
  return (
    <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: 0 }}>
      Открытого времени сейчас нет. Напишите мне – подберём вместе.{' '}
      <button type="button" onClick={onWrite} style={linkBtn}>Написать →</button>
    </p>
  );
}

/**
 * Запись на визитке: по умолчанию только простая форма «напишите мне», чтобы
 * заявка не терялась на выборе времени. Расписание слотов не смонтировано
 * (и /api/booking/slots не запрашивается), пока посетитель сам его не откроет.
 */
export function BookingEntry() {
  const [mode, setMode] = useState<'write' | 'slots'>('write');

  if (mode === 'slots') {
    const toWrite = () => setMode('write');
    return (
      <Suspense fallback={<p style={{ color: 'var(--text-faint)', fontSize: 15, padding: '24px 0' }}>Загружаю свободное время…</p>}>
        <BookingPicker onWriteInstead={toWrite} fallback={<NoSlotsNote onWrite={toWrite} />} />
      </Suspense>
    );
  }

  return (
    <>
      <BookingForm />
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '10px 16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>Или сразу в мессенджер:</span>
        <TgLink label="@kotlarewski" />
        <a href={`mailto:${OPERATOR_EMAIL}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-sub)', textDecoration: 'none' }}>{OPERATOR_EMAIL}</a>
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-faint)', lineHeight: 1.6, margin: '20px 0 0' }}>
        Хотите выбрать время сразу?{' '}
        <button
          type="button" style={linkBtn}
          onClick={() => { trackGoalOnce('booking_schedule_open'); setMode('slots'); }}
        >Открыть расписание →</button>
      </p>
    </>
  );
}
