// День или настенное время для `SessionInfoDto.nextSession`
// (docs/open/backend.md: день внутри момента сверялся только регэкспом).
import { isDayOrWallMoment } from './wall-moment';

describe('isDayOrWallMoment', () => {
  it('день и настенное время с минутами или секундами', () => {
    for (const ok of [
      '2026-10-26',
      '2028-02-29',
      '2026-10-26T00:00',
      '2026-10-26T23:59',
      '2026-10-26T09:05:59',
    ])
      expect(isDayOrWallMoment(ok)).toBe(true);
  });

  it('несуществующий день, часы вне суток, минуты 60, зона, мусор — нет', () => {
    for (const bad of [
      '2026-02-30',
      '2026-02-30T10:00',
      '2026-10-26T24:00',
      '2026-10-26T25:00',
      '2026-10-26T10:60',
      '2026-10-26T10:00:60',
      '2026-10-26T10:00Z',
      '2026-10-26 10:00',
      '2026-10-26T1:00',
      null,
    ])
      expect(isDayOrWallMoment(bad)).toBe(false);
  });
});
