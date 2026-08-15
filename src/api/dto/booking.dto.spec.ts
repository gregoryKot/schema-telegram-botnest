// BookingDto (аудит 2026-08-14, правило №6): заменил локальный interface на
// публичном эндпоинте POST /api/booking. Проверяем, что нестроковое name
// (раньше — необработанный TypeError на .trim(), 500) даёт чистый отказ
// валидации, и что молчаливый путь контроллера (пустое тело) не ломается.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BookingDto } from './booking.dto';

const VALID = {
  name: 'Аня',
  contact: '@anya_tg',
  message: 'Хочу записаться на консультацию',
  source: 'landing?ref=telegram',
};

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(BookingDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('BookingDto — рантайм-валидация публичного эндпоинта бронирования', () => {
  it('валидный полный payload проходит', async () => {
    await expect(errorsFor(VALID)).resolves.toEqual([]);
  });

  it('пустое тело проходит (контроллер сам молча отвечает {ok:true})', async () => {
    await expect(errorsFor({})).resolves.toEqual([]);
  });

  it('name не строка (раньше TypeError 500 на .trim()) — отказ', async () => {
    await expect(errorsFor({ ...VALID, name: 42 })).resolves.toContain('name');
  });

  it('contact не строка — отказ', async () => {
    await expect(
      errorsFor({ ...VALID, contact: { tg: '@x' } }),
    ).resolves.toContain('contact');
  });

  it('мусорное поле срезается whitelist — валидное тело всё равно проходит', async () => {
    await expect(errorsFor({ ...VALID, admin: true })).resolves.toEqual([]);
  });
});
