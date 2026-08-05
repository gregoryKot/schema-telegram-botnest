// Упражнение «Разобрать фразу»: userId берётся из запроса (не из тела),
// текст обрезается по краям, пустая переформулировка не сохраняется пустой
// строкой. Валидность marks обеспечивает DTO — проверка в dto-спеке.
import { PhraseCheckController } from './phrase-check.controller';
import type { PhraseCheckService } from '../bot/phrase-check.service';

function makeController(overrides: Partial<PhraseCheckService> = {}) {
  const service = {
    getPhraseChecks: jest.fn().mockResolvedValue([]),
    createPhraseCheck: jest.fn().mockResolvedValue({ id: 1 }),
    deletePhraseCheck: jest.fn().mockResolvedValue({ count: 1 }),
    ...overrides,
  } as unknown as PhraseCheckService;
  return { controller: new PhraseCheckController(service), service };
}

const req = (userId = 7n) => ({ webUser: { userId } }) as any;

describe('PhraseCheckController', () => {
  it('пишет от имени пользователя из запроса, а не из тела', async () => {
    const { controller, service } = makeController();

    await controller.createPhraseCheck(req(42n), {
      phrase: '  Опять всё не так  ',
      marks: ['person'],
      rewrite: '  Задача сдвинулась на день  ',
    });

    expect(service.createPhraseCheck).toHaveBeenCalledWith(42n, {
      phrase: 'Опять всё не так',
      marks: ['person'],
      rewrite: 'Задача сдвинулась на день',
      inWarmWords: false,
    });
  });

  it('пустая переформулировка уходит как «не заполнено», а не пустой строкой', async () => {
    const { controller, service } = makeController();

    await controller.createPhraseCheck(req(), {
      phrase: 'фраза',
      marks: [],
      rewrite: '   ',
    });

    expect(service.createPhraseCheck).toHaveBeenCalledWith(7n, {
      phrase: 'фраза',
      marks: [],
      rewrite: undefined,
      inWarmWords: false,
    });
  });

  it('«в тёплые слова» доезжает до сервиса, когда его выбрали', async () => {
    const { controller, service } = makeController();

    await controller.createPhraseCheck(req(3n), {
      phrase: 'фраза',
      marks: [],
      rewrite: 'переписанная',
      inWarmWords: true,
    });

    expect(service.createPhraseCheck).toHaveBeenCalledWith(3n, {
      phrase: 'фраза',
      marks: [],
      rewrite: 'переписанная',
      inWarmWords: true,
    });
  });

  it('чтение и удаление идут с userId владельца', async () => {
    const { controller, service } = makeController();

    await controller.getPhraseChecks(req(5n));
    await controller.deletePhraseCheck(req(5n), '12');

    expect(service.getPhraseChecks).toHaveBeenCalledWith(5n);
    expect(service.deletePhraseCheck).toHaveBeenCalledWith(5n, 12);
  });
});
