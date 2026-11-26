// Лимиты заявки «Я психолог» живут в одном месте — DTO (`text-limits.ts`).
// Раньше сервис держал свои 100/500/200/1000, а DTO — 200/1000/300/2000:
// квалификация на 700 знаков проходила DTO и получала из сервиса английское
// «Invalid qualification». Сервис длину больше не проверяет, поэтому граница
// предела обязана проходить именно здесь (шов целиком — test/text-limits.e2e-spec.ts).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitTherapistRequestDto } from './therapist-request.dto';
import {
  THERAPIST_REQUEST_CONTACTS_MAX,
  THERAPIST_REQUEST_MESSAGE_MAX,
  THERAPIST_REQUEST_NAME_MAX,
  THERAPIST_REQUEST_QUAL_MAX,
} from '../utils/text-limits';

const VALID = { fullName: 'Мария', qualification: 'МИСТ', contacts: '@m' };

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(SubmitTherapistRequestDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('SubmitTherapistRequestDto', () => {
  it('минимальная валидная заявка (message необязателен) проходит', async () => {
    await expect(errorsFor(VALID)).resolves.toEqual([]);
  });

  it.each([
    ['fullName', THERAPIST_REQUEST_NAME_MAX],
    ['qualification', THERAPIST_REQUEST_QUAL_MAX],
    ['contacts', THERAPIST_REQUEST_CONTACTS_MAX],
    ['message', THERAPIST_REQUEST_MESSAGE_MAX],
  ])(
    '%s: ровно предел %i проходит, на символ больше — отказ',
    async (field, max) => {
      await expect(
        errorsFor({ ...VALID, [field]: 'x'.repeat(max) }),
      ).resolves.toEqual([]);
      await expect(
        errorsFor({ ...VALID, [field]: 'x'.repeat(max + 1) }),
      ).resolves.toEqual([field]);
    },
  );

  it.each(['fullName', 'qualification', 'contacts'])(
    '%s из одного знака — отказ (нижняя граница 2)',
    async (field) => {
      await expect(errorsFor({ ...VALID, [field]: 'x' })).resolves.toEqual([
        field,
      ]);
    },
  );

  it('квалификация на 700 знаков (раньше DTO пропускал, сервис отвечал Invalid) — отказ', async () => {
    await expect(
      errorsFor({ ...VALID, qualification: 'x'.repeat(700) }),
    ).resolves.toEqual(['qualification']);
  });
});
