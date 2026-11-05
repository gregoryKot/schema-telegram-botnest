// Правило №4: STUB_NEEDS браузерного смока (e2e-browser/support/stubFixtures.ts)
// — копия списка потребностей сервера: Playwright не поднимает Nest и
// BotService не импортирует. До ci-alarm #903 в заглушке жил `freedom`,
// которого у сервера нет (оценку с ним отверг бы `@IsIn(NEED_IDS)`), и этого
// не видел никто: смок гоняется только ночью и ответы с сервером не сверяет.
import { STUB_NEEDS } from '../../e2e-browser/support/stubFixtures';
import type { PrismaService } from '../prisma/prisma.service';
import { BotService } from './bot.service';

describe('STUB_NEEDS браузерного смока ↔ BotService.getNeeds()', () => {
  it('совпадают целиком: id, порядок, эмодзи и названия', () => {
    // getNeeds() в базу не ходит — Prisma здесь только для конструктора.
    const server = new BotService({} as unknown as PrismaService).getNeeds();
    expect(STUB_NEEDS).toEqual(server);
  });
});
