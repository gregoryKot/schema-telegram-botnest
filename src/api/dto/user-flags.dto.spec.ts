// UserFlagsDto (аудит 2026-08-14, правило №6): заменил `Record<string,
// unknown>` на POST /api/user-flags. Раньше значения по разрешённым ключам
// не проверялись по типу (можно было записать объект/массив вместо
// boolean) — теперь это отказ валидации.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserFlagsDto } from './user-flags.dto';

const VALID = {
  themePref: 'dark',
  onboardingV1Done: true,
  onboardingV2Done: false,
  onboardingSkipped: ['step1', 'step2'],
  childhoodWheelDone: true,
  ysqBannerDismissed: false,
  hintSheetCloseShown: true,
  hintHistoryDismissed: false,
  trackerOnboardingDone: true,
  lastCelebrationDate: '2026-08-14',
  lastYesterdayBannerDate: '2026-08-13',
  lastWeeklyQuestionWeek: '2026-W33',
  schemaIntrosShown: ['abandonment', 'mistrust'],
  modeIntrosShown: ['vulnerable-child'],
  defaultSection: 'today',
};

async function validateFlags(
  body: Record<string, unknown>,
): Promise<{ errors: string[]; instance: UserFlagsDto }> {
  const dto = plainToInstance(UserFlagsDto, body);
  const errs = await validate(dto, { whitelist: true });
  return { errors: errs.map((e) => e.property), instance: dto };
}

describe('UserFlagsDto — рантайм-валидация POST /api/user-flags', () => {
  it('валидный payload с booleans/строками/массивами проходит', async () => {
    const { errors } = await validateFlags(VALID);
    expect(errors).toEqual([]);
  });

  it('пустое тело проходит (ничего не выставлено)', async () => {
    const { errors } = await validateFlags({});
    expect(errors).toEqual([]);
  });

  it('объект вместо boolean — отказ (кейс из бейслайна body-dto)', async () => {
    const { errors } = await validateFlags({
      ...VALID,
      onboardingV1Done: {},
    });
    expect(errors).toContain('onboardingV1Done');
  });

  it('массив чисел вместо массива строк — отказ', async () => {
    const { errors } = await validateFlags({
      ...VALID,
      schemaIntrosShown: [1, 2],
    });
    expect(errors).toContain('schemaIntrosShown');
  });

  it('themePref: null проходит (сброс на системную тему)', async () => {
    const { errors } = await validateFlags({ themePref: null });
    expect(errors).toEqual([]);
  });

  it('therapistMode срезается whitelist — эскалацию в терапевтский UI записать нельзя', async () => {
    const { errors, instance } = await validateFlags({
      ...VALID,
      therapistMode: true,
    });
    expect(errors).toEqual([]);
    expect('therapistMode' in instance).toBe(false);
    expect(
      (instance as unknown as Record<string, unknown>).therapistMode,
    ).toBeUndefined();
  });

  it('непосланное поле отсутствует на инстансе (контракт цикла `k in body` контроллера)', async () => {
    const { instance } = await validateFlags({ themePref: 'dark' });
    expect('themePref' in instance).toBe(true);
    expect('onboardingV1Done' in instance).toBe(false);
    expect('schemaIntrosShown' in instance).toBe(false);
  });
});
