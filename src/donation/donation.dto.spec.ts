// L4 (аудит 2026-08, правило №6): DonateDto заменил inline-interface на
// публичном платёжном эндпоинте. Проверяем, что нестроковые email/comment и
// мусорный source дают чистый отказ валидации, а не TypeError→500.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DonateDto } from './donation.dto';

const VALID = {
  amount: 300,
  source: 'app',
  email: 'a@b.co',
  comment: 'спасибо',
};

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(DonateDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('DonateDto — рантайм-валидация публичного платёжного эндпоинта', () => {
  it('валидное тело проходит', async () => {
    await expect(errorsFor(VALID)).resolves.toEqual([]);
  });

  it('минимальное тело (только amount) проходит', async () => {
    await expect(errorsFor({ amount: 100 })).resolves.toEqual([]);
  });

  it('amount не число (type-confusion массив/строка) — отказ', async () => {
    await expect(errorsFor({ amount: [1] })).resolves.toContain('amount');
    await expect(errorsFor({ amount: 'сто' })).resolves.toContain('amount');
  });

  it('source вне союза app|game — отказ', async () => {
    await expect(errorsFor({ ...VALID, source: 'evil' })).resolves.toContain(
      'source',
    );
  });

  it('нестроковый email (раньше 500 на .trim) — чистый отказ (L4)', async () => {
    await expect(errorsFor({ ...VALID, email: ['a@b.co'] })).resolves.toContain(
      'email',
    );
  });

  it('гигантский comment — отказ (спам)', async () => {
    await expect(
      errorsFor({ ...VALID, comment: 'x'.repeat(1001) }),
    ).resolves.toContain('comment');
  });

  it('honeypot website — декорированное поле (whitelist его не срежет): валидная строка проходит', async () => {
    // Ключевой инвариант ловушки: поле должно ПЕРЕЖИВАТЬ whitelist ValidationPipe,
    // иначе controller.donate никогда не увидит website и honeypot умрёт молча.
    await expect(errorsFor({ amount: 100, website: 'bot' })).resolves.toEqual(
      [],
    );
  });
});
