import { BookingStatus } from '@prisma/client';
import { cancelEventUid } from './booking.transitions';

// Какое событие календаря снимать после отмены (аудит 2026-10-11): у HELD
// события нет, у CONFIRMED без записанного uid (под умер между PUT и записью)
// оно есть и снимается по детерминированному uid брони.
describe('cancelEventUid', () => {
  it('записанный uid — как есть, статус не важен', () => {
    expect(
      cancelEventUid(
        { status: BookingStatus.HELD },
        { id: 7, calDavUid: 'cal-7' },
      ),
    ).toBe('cal-7');
  });

  it('CONFIRMED без записанного uid → детерминированный uid брони', () => {
    expect(
      cancelEventUid(
        { status: BookingStatus.CONFIRMED },
        { id: 7, calDavUid: null },
      ),
    ).toBe('booking-7@schemehappens.ru');
  });

  it('HELD без записанного uid → null: события не бывает, DELETE не нужен', () => {
    expect(
      cancelEventUid(
        { status: BookingStatus.HELD },
        { id: 7, calDavUid: null },
      ),
    ).toBeNull();
  });
});
