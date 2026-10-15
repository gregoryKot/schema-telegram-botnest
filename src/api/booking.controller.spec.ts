// Лид-форма /api/booking: контроллер — тонкая обёртка над IntroLeadService
// (запись в БД + уведомления: intro-lead.service.spec.ts, тексты и
// экранирование: intro-lead.format.spec.ts). Здесь — что DTO доходит до
// сервиса как есть, ответ и ошибка сервиса не теряются, и лимит на ручке.
import { BookingController } from './booking.controller';
import type { IntroLeadService } from '../booking/intro-lead.service';
import { PERSISTENT_THROTTLE_KEY } from './persistent-throttle.decorator';

describe('BookingController.submitBooking', () => {
  const dto = {
    name: 'Мария',
    contact: '@maria',
    channel: 'telegram' as const,
  };

  it('передаёт DTO сервису и возвращает его ответ', async () => {
    const submit = jest.fn().mockResolvedValue({ ok: true });
    const controller = new BookingController({
      submit,
    } as unknown as IntroLeadService);
    await expect(controller.submitBooking(dto)).resolves.toEqual({ ok: true });
    expect(submit).toHaveBeenCalledWith(dto);
  });

  it('ошибка сервиса (503: заявка не принята) доходит до клиента, а не превращается в ok:true', async () => {
    const controller = new BookingController({
      submit: jest.fn().mockRejectedValue(new Error('не принята')),
    } as unknown as IntroLeadService);
    await expect(controller.submitBooking(dto)).rejects.toThrow('не принята');
  });
});

// M4 (аудит 2026-10): лид-форма без собственного лимита давала спамить админу
// DM и письмами. Метаданные читаем напрямую, как расставляют декораторы.
describe('BookingController.submitBooking — троттлинг (M4)', () => {
  it('@Throttle long: 6 заявок в час с одного адреса', () => {
    const handler = BookingController.prototype.submitBooking;
    expect(Reflect.getMetadata('THROTTLER:LIMITlong', handler)).toBe(6);
    expect(Reflect.getMetadata('THROTTLER:TTLlong', handler)).toBe(3_600_000);
  });

  it('@PersistentThrottle(): счётчик общий на все инстансы (Postgres)', () => {
    expect(
      Reflect.getMetadata(
        PERSISTENT_THROTTLE_KEY,
        BookingController.prototype.submitBooking,
      ),
    ).toBe(true);
  });
});
